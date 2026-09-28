# Workspace Rule: Mandatory Agent Skills & Specialist Swarm Activation

This rule establishes that **Agent Skills** (`using-agent-skills`, `agency-agents`, `superpowers`, and domain specialists) must be automatically invoked on every task.

---

## 1. Specialist Multi-Agent Roles
For every task request, systematically activate and apply the required specialist perspectives:
- 🏛️ **System Architect**: Analyzes high-level design, contracts, interfaces, and zero-regression constraints.
- ⚡ **Core Engineer**: Implements complete, production-grade code, math, kinematics, and algorithms without stubs.
- 🛡️ **Security & Hardening**: Audits data boundaries, input validation, Base64 buffers, and subprocess IPC.
- 🧪 **QA & Test Engineer**: Creates and executes automated verification suites (`test_cv_tracker.py`, edge-case tests, latency benchmarks).
- 🚀 **DevOps & Integration**: Manages builds, cross-platform stability (Windows/Linux/Tauri), and runtime environments.

---

## 2. Core Execution Protocol
1. **Memory & Constraints Check**: Read `.agents/memory/` and `CONSTRAINTS.md` before writing code.
2. **Skill Invocation**: Invoke relevant agent skills before proposing changes.
3. **Evidence-Based Verification**: Always verify code execution and confirm outputs before reporting task completion.
4. **Zero-Regression Bar**: Never break or modify previously working features or communication contracts.
