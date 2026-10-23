#!/usr/bin/env python3
"""Owner-local, source-redacted static review of PL/pgSQL EXECUTE format().

Not a PostgreSQL parser, dataflow proof, or vulnerability assessment.
Never print function SQL, names, arguments, or contents of a private backup.
"""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

EXPECTED_SHA = "A3E290AE2368D1032786A2202E60B1E328341B8A9C7DFAD1FD9A0F2DABEAD2C6"
FUNCTION_START = re.compile(r"(?im)^\s*CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+")
TAG = re.compile(r"\bAS\s+(\$[A-Za-z_0-9]*\$)", re.I)
WORD = re.compile(r"[A-Za-z_][A-Za-z_0-9$]*")
PLACEHOLDER = re.compile(r"%%|%([sIL])")


def functions_from_dump(sql):
    starts = list(FUNCTION_START.finditer(sql))
    for index, start in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(sql)
        chunk = sql[start.start():end]
        match = TAG.search(chunk)
        if not match:
            continue
        close = chunk.find(match.group(1), match.end())
        if close < 0:
            continue
        meta = chunk[:match.start()] + chunk[close + len(match.group(1)):close + len(match.group(1)) + 200]
        if not re.search(r"\bSECURITY\s+DEFINER\b", meta, re.I):
            continue
        if not re.search(r"\bplpgsql\b", meta, re.I):
            continue
        yield chunk[match.end():close], chunk[:match.start()]


def tokenize(s):
    """Lexical tokens only; comments/quoted literals cannot become EXECUTE keywords."""
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c.isspace():
            i += 1
            continue
        if s.startswith("--", i):
            j = s.find("\n", i + 2)
            i = len(s) if j < 0 else j + 1
            continue
        if s.startswith("/*", i):
            depth = 1
            i += 2
            while i < len(s) and depth:
                if s.startswith("/*", i):
                    depth += 1
                    i += 2
                elif s.startswith("*/", i):
                    depth -= 1
                    i += 2
                else:
                    i += 1
            continue
        if c == "'":
            i += 1
            value = []
            while i < len(s):
                if s[i] == "'":
                    if i + 1 < len(s) and s[i + 1] == "'":
                        value.append("'")
                        i += 2
                        continue
                    i += 1
                    break
                value.append(s[i])
                i += 1
            out.append(("STRING", "".join(value)))
            continue
        if c == '"':
            i += 1
            while i < len(s):
                if s[i] == '"':
                    if i + 1 < len(s) and s[i + 1] == '"':
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            out.append(("IDENT", "<quoted>"))
            continue
        if c == "$":
            tag = re.match(r"\$[A-Za-z_0-9]*\$", s[i:])
            if tag:
                terminator = tag.group()
                j = s.find(terminator, i + len(terminator))
                if j >= 0:
                    out.append(("STRING", "<dollar_literal>"))
                    i = j + len(terminator)
                    continue
        w = WORD.match(s, i)
        if w:
            out.append(("WORD", w.group()))
            i = w.end()
            continue
        if c.isdigit():
            j = i + 1
            while j < len(s) and (s[j].isdigit() or s[j] == "."):
                j += 1
            out.append(("NUMBER", s[i:j]))
            i = j
            continue
        out.append(("SYM", c))
        i += 1
    return out


def format_arguments(tokens, opening):
    if opening >= len(tokens) or tokens[opening][1] != "(":
        return None
    depth, args, current = 1, [], []
    for kind, value in tokens[opening + 1:]:
        if value == "(" and kind == "SYM":
            depth += 1
        elif value == ")" and kind == "SYM":
            depth -= 1
            if depth == 0:
                args.append(current)
                return args
        if value == "," and kind == "SYM" and depth == 1:
            args.append(current)
            current = []
        else:
            current.append((kind, value))
    return None


def expression_class(tokens):
    if len(tokens) == 1 and tokens[0][0] in ("STRING", "NUMBER"):
        return "CONSTANT"
    # Quoting helpers are context-dependent: quote_ident is for identifiers,
    # quote_literal / quote_nullable for values. None proves that a %s-built
    # SQL fragment is correctly placed or authorized.
    if (len(tokens) >= 3 and tokens[0][0] == "WORD"
            and tokens[1] == ("SYM", "(") and tokens[-1] == ("SYM", ")")):
        helper = tokens[0][1].lower()
        if helper == "quote_ident":
            return "QUOTE_IDENT_CALL_CONTEXT_UNVERIFIED"
        if helper in ("quote_literal", "quote_nullable"):
            return "QUOTE_LITERAL_CALL_CONTEXT_UNVERIFIED"
    if len(tokens) == 1 and tokens[0][0] == "WORD":
        return "BARE_IDENTIFIER_OR_PARAMETER_UNRESOLVED"
    if len(tokens) == 1 and tokens[0][0] == "IDENT":
        return "QUOTED_IDENTIFIER_UNRESOLVED"
    return "EXPRESSION_UNRESOLVED"


def function_parameter_names(header):
    """Best-effort named formal args; unknown shapes stay unresolved."""
    toks = tokenize(header)
    for i, item in enumerate(toks):
        if item == ("SYM", "("):
            groups = format_arguments(toks, i)
            if groups is None:
                return set()
            out = set()
            mode_words = {"in", "out", "inout", "variadic"}
            types = {"text", "varchar", "character", "uuid", "int", "integer",
                     "bigint", "boolean", "json", "jsonb", "numeric", "real",
                     "double", "timestamp", "date", "time", "bytea"}
            for group in groups:
                words = [v for k, v in group if k == "WORD"]
                if not words:
                    continue
                candidates = [v for v in words if v.lower() not in mode_words]
                if len(candidates) > 1 and candidates[0].lower() not in types:
                    out.add(candidates[0].lower())
            return out
    return set()


def declared_local_names(tokens):
    try:
        start = next(i for i, t in enumerate(tokens) if t == ("WORD", "DECLARE"))
        end = next(i for i in range(start + 1, len(tokens))
                   if tokens[i] == ("WORD", "BEGIN"))
    except StopIteration:
        return set()
    names, chunk = set(), []
    for token in tokens[start + 1:end] + [("SYM", ";")]:
        if token == ("SYM", ";"):
            words = [v for k, v in chunk if k == "WORD"]
            if words:
                names.add(words[0].lower())
            chunk = []
        else:
            chunk.append(token)
    return names


def expression_origin(expr, parameters, locals_):
    if len(expr) != 1 or expr[0][0] not in ("WORD", "IDENT"):
        return "NONBARE_EXPRESSION_UNRESOLVED"
    token = expr[0][1].lower()
    if token in parameters:
        return "FORMAL_FUNCTION_PARAMETER_POSSIBLE"
    if token in locals_:
        return "LOCALLY_DECLARED_VARIABLE_POSSIBLE"
    return "UNKNOWN_IDENTIFIER_OR_PARAMETER"


def last_assignment_signal(prior_tokens, expr, parameters):
    """No variable names returned, and never claim proven parameter lineage."""
    if len(expr) != 1 or expr[0][0] != "WORD":
        return "NOT_APPLICABLE_OR_UNRESOLVED"
    target = expr[0][1].lower()
    match = None
    for i, token in enumerate(prior_tokens):
        if token[0] != "WORD" or token[1].lower() != target:
            continue
        tail = prior_tokens[i + 1:i + 4]
        assign = (len(tail) >= 2 and tail[0] == ("SYM", ":") and
                  tail[1] == ("SYM", "="))
        if not assign:
            continue
        rhs = []
        for tok in prior_tokens[i + 3:]:
            if tok == ("SYM", ";"):
                break
            rhs.append(tok)
        if len(rhs) == 1 and rhs[0][0] in ("NUMBER", "STRING"):
            match = "CONSTANT_ASSIGNMENT_LEXICAL"
        elif any(k == "WORD" and v.lower() in parameters for k, v in rhs):
            match = "ASSIGNMENT_MENTIONS_FUNCTION_PARAMETER"
        elif any(k == "WORD" and v.lower() in ("format", "quote_ident",
                    "quote_literal", "quote_nullable") for k, v in rhs):
            match = "FORMAT_OR_QUOTE_HELPER_ASSIGNMENT"
        else:
            match = "OTHER_ASSIGNMENT_NOT_TRACED"
    return match or "NO_PRIOR_ASSIGNMENT_LEXICAL"


def has_unresolved_control_flow(tokens):
    """Fail closed for possible branch/loop-dependent assignments.

    This is intentionally conservative. It does not parse a CFG or claim
    every statement is reachable; it only blocks a misleading linear trace.
    """
    markers = {"if", "elsif", "else", "case", "when", "loop",
               "while", "for", "exception"}
    return any(kind == "WORD" and value.lower() in markers
               for kind, value in tokens)


def possible_parameter_flow(prior_tokens, expr, parameters, max_hops=3):
    """Best-effort lexical alias hints, not control-flow or sanitization proof.

    Ignore comments and quoted SQL as statements (tokenizer already excludes them).
    Examine only the latest lexical := assignment at each hop. Branches, SELECT
    INTO, shadowing, callbacks and dynamically constructed expressions remain
    unresolved. Never return private variable names or source.
    """
    if len(expr) != 1 or expr[0][0] != "WORD":
        return "EXPRESSION_NOT_TRACEABLE", False
    current = expr[0][1].lower()
    # Direct reference to a formal argument needs no alias resolution.
    if current in parameters:
        return "DIRECT_PARAMETER_POSSIBLE", True
    # The last textual ':=' may be in an IF/LOOP arm that never runs.
    # Never treat it as the effective assignment without a real CFG.
    if has_unresolved_control_flow(prior_tokens):
        return "BRANCH_OR_LOOP_ASSIGNMENT_UNRESOLVED", False
    seen = set()
    # Each alias's value must be resolved at the time it was assigned to the
    # next variable, NOT at EXECUTE time. Later overwrites cannot change a
    # value that another variable already captured.
    cutoff = len(prior_tokens)
    for depth in range(max_hops + 1):
        if current in parameters:
            if depth == 0:
                return "DIRECT_PARAMETER_POSSIBLE", True
            if depth == 1:
                return "ONE_ASSIGNMENT_PARAMETER_POSSIBLE", True
            return "MULTI_ASSIGNMENT_PARAMETER_POSSIBLE", True
        state = (current, cutoff)
        if state in seen:
            return "ALIAS_CYCLE_UNRESOLVED", False
        seen.add(state)
        rhs = None
        assignment_index = None
        for i in range(cutoff - 3, -1, -1):
            if (prior_tokens[i][0] == "WORD"
                    and prior_tokens[i][1].lower() == current
                    and prior_tokens[i + 1] == ("SYM", ":")
                    and prior_tokens[i + 2] == ("SYM", "=")):
                candidate = []
                for t in prior_tokens[i + 3:cutoff]:
                    if t == ("SYM", ";"):
                        break
                    candidate.append(t)
                rhs = candidate
                assignment_index = i
                break
        if rhs is None:
            return "ASSIGNMENT_NOT_FOUND_UNRESOLVED", False
        if len(rhs) == 1 and rhs[0][0] in ("NUMBER", "STRING"):
            return "LATEST_LEXICAL_ASSIGNMENT_CONSTANT", False
        if len(rhs) == 1 and rhs[0][0] == "WORD":
            current = rhs[0][1].lower()
            cutoff = assignment_index
            continue
        if any(k == "WORD" and v.lower() in parameters for k, v in rhs):
            return "COMPLEX_ASSIGNMENT_MENTIONS_PARAMETER", True
        return "COMPLEX_ASSIGNMENT_UNRESOLVED", False
    return "ALIAS_CHAIN_LIMIT_REACHED", False


def body_authorization_signals(tokens):
    """Lexical evidence only; a keyword never proves an enforced auth guard."""
    auth_call = False
    privilege_call = False
    jwt_config = False
    if_branch = False
    raise_exception = False
    for i, (kind, value) in enumerate(tokens):
        if kind != "WORD":
            continue
        word = value.lower()
        if word == "auth" and i + 3 < len(tokens):
            auth_call |= (tokens[i + 1] == ("SYM", ".")
                          and tokens[i + 2][0] == "WORD"
                          and tokens[i + 2][1].lower() in ("uid", "jwt", "role")
                          and tokens[i + 3] == ("SYM", "("))
        if word in ("has_function_privilege", "has_table_privilege",
                    "has_schema_privilege", "has_database_privilege"):
            privilege_call |= (i + 1 < len(tokens)
                               and tokens[i + 1] == ("SYM", "("))
        if word == "current_setting" and i + 2 < len(tokens):
            jwt_config |= (tokens[i + 1] == ("SYM", "(")
                           and tokens[i + 2][0] == "STRING"
                           and tokens[i + 2][1].lower().startswith("request.jwt"))
        if word == "if":
            if_branch = True
        if word == "raise" and i + 1 < len(tokens):
            raise_exception |= (tokens[i + 1] == ("WORD", "EXCEPTION")
                                or (tokens[i + 1][0] == "WORD"
                                    and tokens[i + 1][1].lower() == "exception"))
    return {
        "directAuthHelperCallLexical": bool(auth_call),
        "jwtCurrentSettingLexical": bool(jwt_config),
        "privilegeHelperCallLexical": bool(privilege_call),
        "ifKeywordLexical": bool(if_branch),
        "raiseExceptionLexical": bool(raise_exception),
        "authorizationGuardProven": False,
    }


def body_findings(body, parameter_names=None):
    tokens = tokenize(body)
    parameter_names = parameter_names or set()
    local_names = declared_local_names(tokens)
    auth_signals = body_authorization_signals(tokens)
    findings = []
    for i, (kind, value) in enumerate(tokens):
        if kind != "WORD" or value.upper() != "EXECUTE":
            continue
        following = tokens[i + 1:]
        segment = []
        for item in following:
            if item == ("SYM", ";"):
                break
            segment.append(item)
        using = any(k == "WORD" and v.upper() == "USING" for k, v in segment)
        detail = {"executeLexical": True, "usingInStatement": using,
                  "formatDirectlyAfterExecute": False, "bindings": [],
                  "hasUnresolvedRawSubstitution": False,
                  "usingDoesNotBindFormatInterpolations": True,
                  "formatArgumentSafetyProven": False,
                  "authorizationSignals": dict(auth_signals),
                  "authorizationSignalsBeforeExecute": body_authorization_signals(tokens[:i]),
                  "authorizationGuardOccursBeforeExecutionProven": False,
                  "staticReviewPriority": "UNRESOLVED",
                  "privilegedExecutionSemanticsVerified": False}
        if len(segment) >= 2 and segment[0][0] == "WORD" and segment[0][1].lower() == "format":
            args = format_arguments(segment, 1)
            if args:
                detail["formatDirectlyAfterExecute"] = True
                template = args[0][0][1] if len(args[0]) == 1 and args[0][0][0] == "STRING" else None
                if template is None or template == "<dollar_literal>":
                    detail["templateKind"] = "UNRESOLVED"
                else:
                    detail["templateKind"] = "STRING_LITERAL"
                    specs = [m.group(1) for m in PLACEHOLDER.finditer(template) if m.group(1)]
                    detail["templateHasPositionalOrUnsupportedFormatDirectives"] = bool(
                        re.search(r"%(?!%|[sIL])", template))
                    detail["templateHasDynamicSqlBindSlot"] = bool(
                        re.search(r"\$[1-9][0-9]*\b", template))
                    for j, spec in enumerate(specs):
                        argclass = expression_class(args[j + 1]) if j + 1 < len(args) else "MISSING"
                        binding = {"specifier": "%" + spec, "argumentClass": argclass}
                        if spec == "s":
                            expr = args[j + 1] if j + 1 < len(args) else []
                            binding["originSignal"] = expression_origin(expr, parameter_names, local_names)
                            binding["priorAssignmentSignal"] = last_assignment_signal(tokens[:i], expr, parameter_names)
                            flow, possible = possible_parameter_flow(tokens[:i], expr, parameter_names)
                            binding["possibleParameterFlowSignal"] = flow
                            binding["possibleParameterFlowLexical"] = possible
                            binding["controlFlowAssignmentUnresolved"] = (
                                has_unresolved_control_flow(tokens[:i])
                                and not (len(expr) == 1 and expr[0][0] == "WORD"
                                         and expr[0][1].lower() in parameter_names))
                            binding["originOrInputSafetyProven"] = False
                            binding["interpolationMechanism"] = "FORMAT_PERCENT_S_NOT_USING_BOUND"
                            binding["percentSQuotationContextVerified"] = False
                            binding["sourceReviewRequired"] = True
                        detail["bindings"].append(binding)
                        # A quote helper does NOT automatically make %s safe:
                        # quote_ident() used as a value, or quote_literal()
                        # used as an identifier can still form unsafe SQL.
                        if spec == "s" and argclass != "CONSTANT":
                            detail["hasUnresolvedRawSubstitution"] = True
                    if detail["hasUnresolvedRawSubstitution"]:
                        detail["staticReviewPriority"] = "RAW_FORMAT_SUBSTITUTION_REVIEW_FIRST"
                    elif any(binding["specifier"] == "%s" for binding in detail["bindings"]):
                        detail["staticReviewPriority"] = "RAW_FORMAT_SUBSTITUTION_SOURCE_REVIEW"
                    elif detail["templateHasPositionalOrUnsupportedFormatDirectives"]:
                        detail["staticReviewPriority"] = "UNSUPPORTED_FORMAT_DIRECTIVES_REVIEW"
                    else:
                        detail["staticReviewPriority"] = "NO_RAW_PERCENT_S_FOUND_NOT_A_SAFETY_VERDICT"
                    # Input from a formal argument remains only a possible
                    # lexical flow: other branches and sanitizers are not proven.
                    detail["possibleCallerInputIntoRawFormat"] = any(
                        b["specifier"] == "%s"
                        and b.get("possibleParameterFlowLexical", False)
                        for b in detail["bindings"])
                    detail["manualAuthorizationReviewRequired"] = any(
                        b["specifier"] == "%s" for b in detail["bindings"])
        findings.append(detail)
    return findings


def inspect_source(sql):
    bodies = list(functions_from_dump(sql))
    findings = []
    for body, header in bodies:
        hits = body_findings(body, function_parameter_names(header))
        if hits:
            findings.append({"case": len(findings) + 1, "statements": hits})
    return {"status": "D8K13_OWNER_LOCAL_REDACTED_EXECUTE_FORMAT_TRIAGE",
            "plpgsqlDefinerBodiesParsed": len(bodies),
            "candidateFunctions": len(findings),
            "cases": findings,
            "sourceOrFunctionIdentifiersReturned": False,
            "staticOnly": True,
            "inputTaintOrRuntimeAuthorizationProven": False,
            "releaseAuthorized": False}


def repo_migration_coverage(sql_sources):
    """Aggregate historical migration declarations, never infer owner ZIP parity.

    The same function can be replaced across many migrations; these counts are
    occurrences, NOT distinct restored functions. Do not return filenames,
    function names/signatures, snippets, or bodies.
    """
    counts = {
        "migrationSourcesScanned": 0,
        "plpgsqlDefinerDeclarationsParsed": 0,
        "executeKeywordDeclarations": 0,
        "executeFormatStatements": 0,
        "rawPercentSFormatStatements": 0,
        "unresolvedRawPercentSStatements": 0,
    }
    for sql in sql_sources:
        counts["migrationSourcesScanned"] += 1
        for body, header in functions_from_dump(sql):
            counts["plpgsqlDefinerDeclarationsParsed"] += 1
            statements = body_findings(body, function_parameter_names(header))
            if statements:
                counts["executeKeywordDeclarations"] += 1
            for stmt in statements:
                if stmt["formatDirectlyAfterExecute"]:
                    counts["executeFormatStatements"] += 1
                    if any(x["specifier"] == "%s" for x in stmt["bindings"]):
                        counts["rawPercentSFormatStatements"] += 1
                        if stmt["hasUnresolvedRawSubstitution"]:
                            counts["unresolvedRawPercentSStatements"] += 1
    return {
        "status": "D8K13_REPO_MIGRATION_DEFINER_SOURCE_COVERAGE",
        **counts,
        "countsMayIncludeSupersededFunctionDefinitions": True,
        "ownerCandidateBIdentifiedInRepo": False,
        "ownerZipSchemaParityVerified": False,
        "privateZipAccessed": False,
        "rawSqlOrIdentifiersReturned": False,
        "releaseAuthorized": False,
    }


def self_test():
    example = """-- EXECUTE format('bad %s', unsafe);
    PERFORM 'EXECUTE format(''bad %s'')';
    BEGIN EXECUTE format('select %I where col = %s', 'safe', untrusted) USING 1; END;"""
    r = body_findings(example)
    assert len(r) == 1, "comments/strings should not appear as EXECUTE statements"
    assert r[0]["formatDirectlyAfterExecute"]
    assert [x["specifier"] for x in r[0]["bindings"]] == ["%I", "%s"]
    assert r[0]["hasUnresolvedRawSubstitution"]
    assert r[0]["usingInStatement"]
    assert r[0]["usingDoesNotBindFormatInterpolations"] is True
    assert r[0]["staticReviewPriority"] == "RAW_FORMAT_SUBSTITUTION_REVIEW_FIRST"
    assert r[0]["formatArgumentSafetyProven"] is False
    bound = body_findings("BEGIN EXECUTE format('SELECT %s WHERE id = $1', input_expr) USING 42; END;")
    assert bound[0]["templateHasDynamicSqlBindSlot"] is True
    assert bound[0]["bindings"][0]["interpolationMechanism"] == "FORMAT_PERCENT_S_NOT_USING_BOUND"
    assert bound[0]["staticReviewPriority"] == "RAW_FORMAT_SUBSTITUTION_REVIEW_FIRST"
    no_directive = body_findings("BEGIN EXECUTE format('SELECT %I', column_name); END;")
    assert no_directive[0]["staticReviewPriority"] == "NO_RAW_PERCENT_S_FOUND_NOT_A_SAFETY_VERDICT"
    # A visible auth.uid() invocation is a signal, not a proven guard.
    guarded = body_findings(
        "BEGIN IF auth.uid() IS NULL THEN RAISE EXCEPTION 'denied'; END IF; "
        "EXECUTE format('SELECT %s', p_input); END;", {"p_input"})
    g = guarded[0]
    assert g["authorizationSignals"]["directAuthHelperCallLexical"] is True
    assert g["authorizationSignals"]["raiseExceptionLexical"] is True
    assert g["authorizationSignals"]["authorizationGuardProven"] is False
    assert g["possibleCallerInputIntoRawFormat"] is True
    assert g["manualAuthorizationReviewRequired"] is True
    no_guard = body_findings("BEGIN EXECUTE format('SELECT %s', p_input); END;", {"p_input"})
    assert no_guard[0]["authorizationSignals"]["directAuthHelperCallLexical"] is False
    assert no_guard[0]["manualAuthorizationReviewRequired"] is True
    # A quoted string/comment referring to auth.uid is not a function call.
    decoy = body_findings(
        "BEGIN PERFORM 'auth.uid()'; -- auth.uid()"
        "\n EXECUTE format('SELECT %s', 1); END;")
    assert decoy[0]["authorizationSignals"]["directAuthHelperCallLexical"] is False

    # Auth checks after dynamic SQL cannot justify earlier execution.
    auth_after = body_findings(
        "BEGIN EXECUTE format('SELECT %s', p_input); "
        "IF auth.uid() IS NULL THEN RAISE EXCEPTION 'denied'; END IF; END;",
        {"p_input"})
    assert auth_after[0]["authorizationSignals"]["directAuthHelperCallLexical"] is True
    assert auth_after[0]["authorizationSignalsBeforeExecute"]["directAuthHelperCallLexical"] is False
    assert auth_after[0]["authorizationGuardOccursBeforeExecutionProven"] is False
    assert guarded[0]["authorizationSignalsBeforeExecute"]["directAuthHelperCallLexical"] is True
    assert guarded[0]["authorizationGuardOccursBeforeExecutionProven"] is False


    numbered = body_findings("BEGIN EXECUTE format('SELECT %2$s', ignored, input_expr); END;")
    assert numbered[0]["templateHasPositionalOrUnsupportedFormatDirectives"] is True

    quoted_ident = body_findings(
        "BEGIN EXECUTE format('SELECT %s', quote_ident(p_col)); END;")
    qi = quoted_ident[0]["bindings"][0]
    assert qi["argumentClass"] == "QUOTE_IDENT_CALL_CONTEXT_UNVERIFIED"
    assert quoted_ident[0]["hasUnresolvedRawSubstitution"] is True
    assert quoted_ident[0]["staticReviewPriority"] == "RAW_FORMAT_SUBSTITUTION_REVIEW_FIRST"
    assert qi["percentSQuotationContextVerified"] is False
    quoted_value = body_findings(
        "BEGIN EXECUTE format('SELECT %s', quote_literal(p_value)); END;")
    qv = quoted_value[0]["bindings"][0]
    assert qv["argumentClass"] == "QUOTE_LITERAL_CALL_CONTEXT_UNVERIFIED"
    assert quoted_value[0]["hasUnresolvedRawSubstitution"] is True
    nullable = body_findings(
        "BEGIN EXECUTE format('SELECT %s', quote_nullable(p_value)); END;")
    assert nullable[0]["hasUnresolvedRawSubstitution"] is True
    bare_helper_name = body_findings(
        "BEGIN EXECUTE format('SELECT %s', quote_ident); END;")
    assert bare_helper_name[0]["bindings"][0]["argumentClass"] == "BARE_IDENTIFIER_OR_PARAMETER_UNRESOLVED"
    # Literal SQL remains review-required even if no variable taint is seen.
    safe = body_findings("BEGIN EXECUTE format('select %s', 7); END;")
    assert len(safe) == 1 and not safe[0]["hasUnresolvedRawSubstitution"]
    assert len(body_findings("BEGIN /* EXECUTE fake; */ RETURN 1; END;")) == 0
    formal = function_parameter_names("public.synthetic(in p_input text, p_count integer) RETURNS void")
    assert "p_input" in formal and "p_count" in formal
    local = body_findings("DECLARE tmp text; BEGIN tmp := p_input; EXECUTE format('select %s', tmp); END;", formal)
    assert local[0]["bindings"][0]["originSignal"] == "LOCALLY_DECLARED_VARIABLE_POSSIBLE"
    assert local[0]["bindings"][0]["priorAssignmentSignal"] == "ASSIGNMENT_MENTIONS_FUNCTION_PARAMETER"
    direct = body_findings("BEGIN EXECUTE format('select %s', p_input); END;", formal)
    assert direct[0]["bindings"][0]["originSignal"] == "FORMAL_FUNCTION_PARAMETER_POSSIBLE"
    unknown = body_findings("BEGIN EXECUTE format('select %s', suspicious); END;", set())
    assert unknown[0]["bindings"][0]["originSignal"] == "UNKNOWN_IDENTIFIER_OR_PARAMETER"
    assert unknown[0]["bindings"][0]["originOrInputSafetyProven"] is False
    fixture = """CREATE FUNCTION public.synthetic(p_input text) RETURNS void
    LANGUAGE 'plpgsql' SECURITY DEFINER AS $function$
    DECLARE temp_sql text;
    BEGIN
      -- EXECUTE format('ignore %s', commented);
      temp_sql := p_input;
      EXECUTE format('SELECT %s', temp_sql) USING 1;
    END;
    $function$;"""
    scan = inspect_source(fixture)
    assert scan["plpgsqlDefinerBodiesParsed"] == 1
    assert scan["candidateFunctions"] == 1
    binding = scan["cases"][0]["statements"][0]["bindings"][0]
    assert binding["originSignal"] == "LOCALLY_DECLARED_VARIABLE_POSSIBLE"
    assert binding["priorAssignmentSignal"] == "ASSIGNMENT_MENTIONS_FUNCTION_PARAMETER"
    assert binding["originOrInputSafetyProven"] is False
    assert binding["possibleParameterFlowSignal"] == "ONE_ASSIGNMENT_PARAMETER_POSSIBLE"
    alias = body_findings(
        "DECLARE a text; b text; BEGIN a := p_input; b := a; EXECUTE format('SELECT %s', b); END;",
        {"p_input"})
    ab = alias[0]["bindings"][0]
    assert ab["possibleParameterFlowSignal"] == "MULTI_ASSIGNMENT_PARAMETER_POSSIBLE"
    assert ab["possibleParameterFlowLexical"] is True
    overwritten = body_findings(
        "DECLARE a text; BEGIN a := p_input; a := 'fixed'; EXECUTE format('SELECT %s', a); END;",
        {"p_input"})
    assert overwritten[0]["bindings"][0]["possibleParameterFlowSignal"] == "LATEST_LEXICAL_ASSIGNMENT_CONSTANT"

    # A branch's last textual assignment is not a proven runtime assignment.
    conditional = body_findings(
        "DECLARE a text; BEGIN a := p_input; IF flag THEN a := 'safe'; END IF; "
        "EXECUTE format('SELECT %s', a); END;", {"p_input"})
    cb = conditional[0]["bindings"][0]
    assert cb["possibleParameterFlowSignal"] == "BRANCH_OR_LOOP_ASSIGNMENT_UNRESOLVED"
    assert cb["possibleParameterFlowLexical"] is False
    assert cb["controlFlowAssignmentUnresolved"] is True
    # A direct formal argument is still a possible input regardless of IF blocks.
    direct_branch = body_findings(
        "BEGIN IF flag THEN PERFORM 1; END IF; "
        "EXECUTE format('SELECT %s', p_input); END;", {"p_input"})
    db = direct_branch[0]["bindings"][0]
    assert db["possibleParameterFlowSignal"] == "DIRECT_PARAMETER_POSSIBLE"
    assert db["possibleParameterFlowLexical"] is True
    assert db["controlFlowAssignmentUnresolved"] is False

    # Reassignment after an alias capture cannot retroactively make the
    # captured input constant. This previously produced false reassurance.
    captured = body_findings(
        "DECLARE a text; b text; BEGIN a := p_input; b := a; "
        "a := 'fixed'; EXECUTE format('SELECT %s', b); END;", {"p_input"})
    captured_binding = captured[0]["bindings"][0]
    assert captured_binding["possibleParameterFlowSignal"] == "MULTI_ASSIGNMENT_PARAMETER_POSSIBLE"
    assert captured_binding["possibleParameterFlowLexical"] is True
    # Likewise, an assignment made AFTER an alias capture cannot become
    # its source when looking backwards.
    forward = body_findings(
        "DECLARE a text; b text; BEGIN b := a; a := p_input; "
        "EXECUTE format('SELECT %s', b); END;", {"p_input"})
    forward_binding = forward[0]["bindings"][0]
    assert forward_binding["possibleParameterFlowSignal"] == "ASSIGNMENT_NOT_FOUND_UNRESOLVED"
    assert forward_binding["possibleParameterFlowLexical"] is False
    # If the alias itself is overwritten later, the latest assignment wins.
    overwritten_alias = body_findings(
        "DECLARE a text; b text; BEGIN a := p_input; b := a; "
        "b := 'fixed'; EXECUTE format('SELECT %s', b); END;", {"p_input"})
    assert overwritten_alias[0]["bindings"][0]["possibleParameterFlowSignal"] == "LATEST_LEXICAL_ASSIGNMENT_CONSTANT"
    assert overwritten_alias[0]["bindings"][0]["originOrInputSafetyProven"] is False


    unknown_flow = body_findings("BEGIN EXECUTE format('SELECT %s', nothing); END;", set())
    assert unknown_flow[0]["bindings"][0]["possibleParameterFlowLexical"] is False

    coverage = repo_migration_coverage([fixture])
    assert coverage["plpgsqlDefinerDeclarationsParsed"] == 1
    assert coverage["executeFormatStatements"] == 1
    assert coverage["rawPercentSFormatStatements"] == 1
    assert coverage["ownerCandidateBIdentifiedInRepo"] is False
    assert coverage["ownerZipSchemaParityVerified"] is False
    print(json.dumps({"status": "D8K13_PYTHON_LEXER_SELF_TEST_PASS", "rawSourceReturned": False}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--scan-repo-migrations", type=Path)
    parser.add_argument("--zip", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.scan_repo_migrations is not None:
        root = args.scan_repo_migrations
        files = sorted(root.glob("*.sql")) if root.is_dir() else []
        if not files:
            raise SystemExit("D8K13_REPO_MIGRATIONS_NOT_FOUND")
        summary = repo_migration_coverage(
            path.read_text(encoding="utf-8") for path in files)
        if summary["migrationSourcesScanned"] != len(files):
            raise SystemExit("D8K13_REPO_MIGRATION_SCAN_INCOMPLETE")
        print(json.dumps(summary, separators=(",", ":")))
        return
    if not args.zip or not args.zip.is_file() or args.zip.stat().st_size != 7323679:
        raise SystemExit("D8K13_LOCAL_ZIP_METADATA_MISMATCH")
    h = hashlib.sha256()
    with args.zip.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    if h.hexdigest().upper() != EXPECTED_SHA:
        raise SystemExit("D8K13_LOCAL_ZIP_HASH_MISMATCH")
    with zipfile.ZipFile(args.zip) as z:
        candidates = [n for n in z.namelist() if n.endswith("schema.sql")]
        if len(candidates) != 1:
            raise SystemExit("D8K13_LOCAL_SCHEMA_NOT_UNIQUE")
        source = z.read(candidates[0]).decode("utf-8")
    result = inspect_source(source)
    if result["plpgsqlDefinerBodiesParsed"] < 110 or result["candidateFunctions"] < 1:
        raise SystemExit("D8K13_LOCAL_SOURCE_COVERAGE_BLOCKED")
    result["ownerZipHashPreserved"] = hashlib.sha256(args.zip.read_bytes()).hexdigest().upper() == EXPECTED_SHA
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
