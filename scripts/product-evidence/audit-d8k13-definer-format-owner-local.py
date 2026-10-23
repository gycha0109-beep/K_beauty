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
    if tokens and tokens[0][0] == "WORD" and tokens[0][1].lower() in (
        "quote_literal", "quote_nullable", "quote_ident"
    ):
        return "QUOTE_HELPER_CALL"
    if len(tokens) == 1 and tokens[0][0] in ("WORD", "IDENT"):
        return "BARE_IDENTIFIER_OR_PARAMETER_UNRESOLVED"
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


def body_findings(body, parameter_names=None):
    tokens = tokenize(body)
    parameter_names = parameter_names or set()
    local_names = declared_local_names(tokens)
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
                  "hasUnresolvedRawSubstitution": False}
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
                    for j, spec in enumerate(specs):
                        argclass = expression_class(args[j + 1]) if j + 1 < len(args) else "MISSING"
                        binding = {"specifier": "%" + spec, "argumentClass": argclass}
                        if spec == "s":
                            expr = args[j + 1] if j + 1 < len(args) else []
                            binding["originSignal"] = expression_origin(expr, parameter_names, local_names)
                            binding["priorAssignmentSignal"] = last_assignment_signal(tokens[:i], expr, parameter_names)
                            binding["originOrInputSafetyProven"] = False
                        detail["bindings"].append(binding)
                        if spec == "s" and argclass not in ("CONSTANT", "QUOTE_HELPER_CALL"):
                            detail["hasUnresolvedRawSubstitution"] = True
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
    print(json.dumps({"status": "D8K13_PYTHON_LEXER_SELF_TEST_PASS", "rawSourceReturned": False}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--zip", type=Path)
    args = parser.parse_args()
    if args.self_test:
        self_test()
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
    result["ownerZipHashPreserved"] = hashlib.sha256(args.zip.read_bytes()).hexdigest().upper() == EXPECTED_SHA
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
