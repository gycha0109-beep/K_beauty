/**
 * Offline package-lock v3 dependency-route analyzer.
 * Evidence only: this does not adjudicate CVEs or disable npm audit.
 * No network, process execution, lockfile mutation, or advisory allowlisting.
 */
const TARGETS = Object.freeze([
  Object.freeze({ package: "braces", advisory: "GHSA-vfj7-8cjw-p6xm", affectedLockedVersion: "3.0.3", exceptionExpiresUtc: "2026-10-10T00:00:00.000Z" }),
  Object.freeze({ package: "node-forge", advisory: "GHSA-86w9-cpqp-85rv", affectedLockedVersion: "1.4.0", exceptionExpiresUtc: "2026-10-16T00:00:00.000Z" })
]);

function own(o, key) {
  return Object.prototype.hasOwnProperty.call(o, key);
}

function asDependencies(pkg) {
  const dependencies = {};
  for (const kind of ["dependencies", "optionalDependencies"]) {
    const source = pkg?.[kind];
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    for (const name of Object.keys(source)) dependencies[name] = kind;
  }
  return dependencies;
}

function candidateLocations(from, dependencyName) {
  const candidates = [];
  let context = from;
  for (let n = 0; n < 64; n++) {
    candidates.push(context ? context + "/node_modules/" + dependencyName : "node_modules/" + dependencyName);
    const last = context.lastIndexOf("/node_modules/");
    if (last >= 0) {
      context = context.slice(0, last);
    } else if (context.startsWith("node_modules/")) {
      context = "";
    } else if (context !== "") {
      context = "";
    } else {
      break;
    }
  }
  return candidates;
}

function resolveDependency(packages, from, name) {
  for (const candidate of candidateLocations(from, name)) {
    if (own(packages, candidate)) return candidate;
  }
  return null;
}

function workspaceRoots(packages) {
  return Object.keys(packages).filter((key) =>
    key === "" ||
    (/^(?:apps|packages|tools)\/[^/]+$/.test(key) && typeof packages[key]?.name === "string")
  );
}

function pathPackageName(path, pkg) {
  if (pkg?.name) return pkg.name;
  const n = path.lastIndexOf("/node_modules/");
  return (n >= 0 ? path.slice(n + 14) : path.replace(/^node_modules\//, ""));
}

function isPackagePath(path, packageName) {
  return path === "node_modules/" + packageName || path.endsWith("/node_modules/" + packageName);
}

export function traceSupplyChainLockGraph(lock, options = {}) {
  const packages = lock?.packages;
  if (lock?.lockfileVersion !== 3 || !packages || typeof packages !== "object" ||
      Array.isArray(packages) || !own(packages, "")) {
    return Object.freeze({status:"BLOCKED_INVALID_LOCKFILE", audit_gate_unchanged:true, targets:[]});
  }
  const roots = workspaceRoots(packages);
  const pending = [...roots];
  const parents = new Map(roots.map(r => [r, null]));
  const edgeKinds = new Map();
  const unresolved = [];
  while (pending.length) {
    const from = pending.shift();
    const dependencies = asDependencies(packages[from]);
    for (const [name, kind] of Object.entries(dependencies)) {
      const found = resolveDependency(packages, from, name);
      if (!found) {
        // May be optional/peer/OS-specific, so preserve unknown; never claim safety.
        unresolved.push({from, dependency:name, kind});
        continue;
      }
      if (!parents.has(found)) {
        parents.set(found, from);
        edgeKinds.set(found, kind);
        pending.push(found);
      }
    }
  }

  const limit = Number.isSafeInteger(options.maxExamples) &&
    options.maxExamples > 0 && options.maxExamples <= 20 ? options.maxExamples : 5;
  const targets = TARGETS.map((target) => {
    const allInstalled = Object.entries(packages)
      .filter(([path, pkg]) => isPackagePath(path, target.package) &&
        typeof pkg?.version === "string")
      .map(([path, pkg]) => ({path,version:pkg.version})).sort((a,b)=>a.path.localeCompare(b.path));
    const reachable = allInstalled.filter(x => parents.has(x.path));
    const examples = reachable.slice(0,limit).map((entry) => {
      const chain = [];
      let next = entry.path;
      for (let i = 0; i < Math.min(Object.keys(packages).length + 1, 4096); i++) {
        chain.push({
          path: next,
          package: pathPackageName(next, packages[next]),
          version: packages[next]?.version ?? null,
          relationship: edgeKinds.get(next) ?? (roots.includes(next) ? "root_or_workspace" : "unknown")
        });
        const parent = parents.get(next);
        if (parent === null || parent === undefined) break;
        next = parent;
      }
      return {targetPath:entry.path,chain:chain.reverse()};
    });
    const versionAffected = reachable.some(entry => entry.version === target.affectedLockedVersion);
    return {
      package:target.package,
      advisory:target.advisory,
      knownAffectedLockedVersion:target.affectedLockedVersion,
      knownExceptionExpiresUtc:target.exceptionExpiresUtc,
      installedVersions:[...new Set(allInstalled.map(x=>x.version))].sort(),
      installedPathCount:allInstalled.length,
      reachablePathCount:reachable.length,
      knownAffectedReachable:versionAffected,
      resolution_status:versionAffected ? "KNOWN_AFFECTED_PATH_REQUIRES_SECURITY_REMEDIATION" :
        (allInstalled.length ? "NO_KNOWN_AFFECTED_VERSION_DETECTED_REQUIRES_AUDIT" :
          "NOT_INSTALLED_IN_LOCK_REQUIRES_AUDIT"),
      exampleDependencyChains:examples
    };
  });
  return {
    status:"EVIDENCE_ONLY_NOT_A_SECURITY_PASS",
    lockfileVersion:lock.lockfileVersion,
    roots:roots.map(path=>({path,name:packages[path]?.name??"root"})),
    reachablePackageCount:parents.size,
    unresolvedDependencyEdges:unresolved.length,
    unresolvedDependencyExamples:unresolved.slice(0,10),
    targets,
    audit_gate_unchanged:true,
    exception_dates_unchanged:true,
    production_write_authorized:false,
    scope:"This only shows npm lockfile dependency edges; it does not prove runtime reachability or exploitability.",
    inference_warning:"A missing path or clean trace never overrides npm audit, CI policy, or the security owner's approval."
  };
}
