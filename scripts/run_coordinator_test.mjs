import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  JsonFileSession,
  JsonRunStore,
  RunCoordinator,
  createTeamTask,
  AgentActionVerificationError,
} from './agent.testbundle.mjs';

const config = { baseUrl: 'http://mock/v1', model: 'mock', exportDir: '', workspaceRoot: '' };
const usage = { inputTokens: 1, outputTokens: 2, requests: 1 };

async function fixture(executeAgent, planTask, team = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'plc-coordinator-test-'));
  const session = new JsonFileSession(path.join(dir, 'session.json'));
  const store = new JsonRunStore(path.join(dir, 'runs.json'));
  const events = [];
  const coordinator = new RunCoordinator({
    session,
    store,
    executeAgent,
    planTask,
    ...team,
    emit: (event) => events.push(event),
  });
  return { dir, session, store, events, coordinator };
}

function completedAgentResult(message) {
  return {
    protocolVersion: 1,
    status: 'completed',
    output: { message, diagnostics: [], artifacts: [], data: null },
    diagnostics: [],
    artifacts: [],
    usage,
  };
}

function governedTeam(executionGraph, verifyTeamTask = async () => ({
  passed: true,
  decision: 'pass',
  summary: 'verified',
  evidence: ['done'],
  gaps: [],
})) {
  return {
    routeTeamTask: async (_cfg, text) => createTeamTask({
      route: 'team',
      goal: text,
      reason: 'governed Team test',
      planSummary: 'execute governed graph',
      reviewFocus: [],
      verificationCriteria: ['done'],
    }, text),
    planTeamTask: async () => ({
      planSummary: 'execute governed graph',
      reviewFocus: [],
      verificationCriteria: ['done'],
      executionGraph,
    }),
    reviewTeamTask: async () => ({ approved: true, summary: 'approved', findings: [], requiredChanges: [] }),
    verifyTeamTask,
  };
}

// A model-selected generic plan is persisted and progress is validated in
// order without changing the existing single-agent execution contract.
{
  let plannerCalls = 0;
  let receivedPlan;
  const test = await fixture(async (_cfg, _session, _userText, options) => {
    receivedPlan = options.taskPlan;
    await options.onPlanProgress({ stepId: 'step-1', phase: 'started', note: '准备完成' });
    await options.onPlanProgress({
      stepId: 'step-1',
      phase: 'completed',
      note: '发现输入不完整，继续补充',
      verification: {
        verdict: 'retry',
        evidence: '读取到的输入缺少目标参数',
        issue: '缺少目标参数',
        nextAction: '补充读取必要参数',
      },
    });
    await options.onPlanProgress({
      stepId: 'step-1',
      phase: 'completed',
      note: '输入已确认',
      verification: { verdict: 'passed', evidence: '已读取并确认全部必要输入' },
    });
    await options.onPlanProgress({ stepId: 'step-2', phase: 'started' });
    await options.onPlanProgress({
      stepId: 'step-2',
      phase: 'completed',
      note: '目标已完成',
      verification: { verdict: 'passed', evidence: '执行结果满足本步骤完成标准' },
    });
    return { status: 'completed', output: 'planned result', usage };
  }, async () => {
    plannerCalls += 1;
    return {
      schemaVersion: 1,
      id: 'plan-test',
      goal: '完成一个通用多步任务',
      reason: '存在先后依赖',
      status: 'pending',
      steps: [
        { id: 'step-1', title: '准备', objective: '准备输入', completionCriteria: '输入就绪', suggestedTools: [], status: 'pending' },
        { id: 'step-2', title: '执行', objective: '完成目标', completionCriteria: '目标完成', suggestedTools: [], status: 'pending' },
      ],
    };
  });
  await test.coordinator.start('通用多步任务', config, 'key');
  const planned = await test.store.getLast();
  if (
    plannerCalls !== 1 ||
    receivedPlan?.steps.length !== 2 ||
    planned?.plan?.status !== 'completed' ||
    planned.plan.steps.some((step) => step.verification?.verdict !== 'passed')
  ) {
    throw new Error('linear plan was not executed or persisted');
  }
  const planEvents = test.events
    .filter((event) => event.type === 'agentEvent')
    .map((event) => event.event)
    .filter((event) => event.type === 'run.progress' && String(event.payload.stage).startsWith('plan.'));
  if (!planEvents.some((event) => event.payload.stage === 'plan.created') ||
      !planEvents.some((event) => event.payload.stage === 'plan.step.verification_failed') ||
      planEvents.filter((event) => String(event.payload.stage).startsWith('plan.step.')).length !== 5) {
    throw new Error('linear plan progress events are missing');
  }
}

// If a simple request was misplanned and the executor never advances the
// linear plan, fall back to the ordinary single-agent path instead of failing
// the run with AgentActionVerificationError.
{
  let executorCalls = 0;
  const receivedPlans = [];
  const test = await fixture(async (_cfg, _session, _userText, options) => {
    executorCalls += 1;
    receivedPlans.push(options.taskPlan);
    if (executorCalls === 1) {
      throw new AgentActionVerificationError('线性计划尚未完成: step-1 检查git版本');
    }
    if (options.taskPlan !== undefined) {
      throw new Error('fallback executor should not receive the stale linear plan');
    }
    return { status: 'completed', output: 'git version 2.51.0\njava version 21', usage, result: completedAgentResult('versions complete') };
  }, async () => ({
    schemaVersion: 1,
    id: 'plan-version',
    goal: '查看一下git和java的版本',
    reason: 'planner incorrectly split independent checks',
    status: 'pending',
    steps: [
      { id: 'step-1', title: '检查git版本', objective: '检查 git 版本', completionCriteria: '看到 git version', suggestedTools: ['run_command'], status: 'pending' },
      { id: 'step-2', title: '检查java版本', objective: '检查 java 版本', completionCriteria: '看到 java version', suggestedTools: ['run_command'], status: 'pending' },
    ],
  }));
  await test.coordinator.start('查看一下git和java的版本', config, 'key');
  const completed = await test.store.getLast();
  const fallbackEvent = test.events
    .filter((event) => event.type === 'agentEvent')
    .map((event) => event.event)
    .find((event) => event.type === 'run.progress' && event.payload.stage === 'plan.fallback');
  if (
    executorCalls !== 2 ||
    receivedPlans[0]?.id !== 'plan-version' ||
    receivedPlans[1] !== undefined ||
    completed?.status !== 'completed' ||
    completed.plan !== undefined ||
    !completed.output.includes('git version') ||
    !fallbackEvent
  ) {
    throw new Error('linear plan fallback did not retry as a single-agent run');
  }
}

// Existing team orchestration already owns planning and must not receive a
// second generic planner pass.
{
  let plannerCalls = 0;
  const test = await fixture(
    async () => ({ status: 'completed', output: 'team result', usage }),
    async () => { plannerCalls += 1; return undefined; },
  );
  await test.coordinator.start('team task', { ...config, orchestration: 'team' }, 'key');
  if (plannerCalls !== 0) throw new Error('team orchestration invoked the generic planner');
}

// A gateway failure during automatic routing is a coordinator checkpoint even
// before the SDK has created a RunState. Continue retries routing, then enters
// the normal Team lifecycle instead of reporting that no checkpoint exists.
{
  let routeCalls = 0;
  let executorCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: 'routed and completed', usage, result: completedAgentResult('routed and completed') };
  }, undefined, {
    routeTeamTask: async () => {
      routeCalls += 1;
      if (routeCalls === 1) throw Object.assign(new Error('502 Model gateway is unavailable'), { status: 502 });
      return createTeamTask({
        route: 'team', goal: 'route resume', reason: 'complex', planSummary: 'execute', reviewFocus: [], verificationCriteria: ['done'],
      }, 'route resume');
    },
    planTeamTask: async () => ({ planSummary: 'execute', reviewFocus: [], verificationCriteria: ['done'] }),
    reviewTeamTask: async () => ({ approved: true, summary: 'approved', findings: [], requiredChanges: [] }),
    verifyTeamTask: async () => ({ passed: true, summary: 'verified', evidence: ['done'], gaps: [] }),
  });
  await test.coordinator.start('route resume', { ...config, orchestration: 'auto' }, 'key');
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.resumeStage !== 'routing' || !paused.canContinue) {
    throw new Error('routing gateway failure did not persist a preflight checkpoint');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (routeCalls !== 2 || executorCalls !== 1 || completed?.status !== 'completed') {
    throw new Error('continue did not resume automatic routing from its checkpoint');
  }
}

// The Team planner can provide a real DAG: independent read nodes overlap,
// while a dependent write node runs alone and still reaches verification.
{
  let active = 0;
  let maxActive = 0;
  const calls = [];
  const test = await fixture(async (cfg, _session, text) => {
    const isWrite = text.includes('写入');
    calls.push({ text, dryRun: cfg.policyContext?.dryRun === true });
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, isWrite ? 1 : 20));
    active -= 1;
    return { status: 'completed', output: isWrite ? '写入完成' : '读取完成', usage, result: completedAgentResult(isWrite ? '写入完成' : '读取完成') };
  }, undefined, {
    routeTeamTask: async () => createTeamTask({
      route: 'team', goal: 'DAG', reason: 'parallel reads', planSummary: 'read then write', reviewFocus: [], verificationCriteria: ['done'],
    }, 'DAG'),
    planTeamTask: async () => ({
      planSummary: 'read then write', reviewFocus: [], verificationCriteria: ['done'],
      executionGraph: {
        maxParallelism: 2,
        nodes: [
          { id: 'read-a', title: '读取 A', objective: '读取 A', dependsOn: [], completionCriteria: '有结果', suggestedTools: ['read_file'], effect: 'read', resources: ['a'], parallelSafe: true },
          { id: 'read-b', title: '读取 B', objective: '读取 B', dependsOn: [], completionCriteria: '有结果', suggestedTools: ['read_file'], effect: 'read', resources: ['b'], parallelSafe: true },
          { id: 'write', title: '写入结果', objective: '写入结果', dependsOn: ['read-a', 'read-b'], completionCriteria: '写入成功', suggestedTools: ['write_file'], effect: 'write', resources: ['workspace'], parallelSafe: false },
        ],
      },
    }),
    reviewTeamTask: async () => ({ approved: true, summary: 'approved', findings: [], requiredChanges: [] }),
    verifyTeamTask: async () => ({ passed: true, summary: 'verified', evidence: ['done'], gaps: [] }),
  });
  await test.coordinator.start('DAG', { ...config, orchestration: 'auto' }, 'key');
  const completed = await test.store.getLast();
  if (maxActive !== 2 || calls.length !== 3 || !calls.filter((call) => call.text.includes('读取')).every((call) => call.dryRun) || calls.find((call) => call.text.includes('写入'))?.dryRun || completed?.status !== 'completed') {
    throw new Error('DAG scheduler did not enforce parallel-safe and side-effect boundaries');
  }
}

// The request budget caps a ready parallel batch before any model call starts,
// then fails the still-incomplete graph at the persisted budget boundary.
{
  let executorCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: 'read complete', usage, result: completedAgentResult('read complete') };
  }, undefined, governedTeam({
    maxParallelism: 2,
    budget: { maxRequests: 1 },
    nodes: [
      { id: 'read-a', title: 'Read A', objective: 'read A', dependsOn: [], completionCriteria: 'done', suggestedTools: ['read_file'], effect: 'read', resources: ['a'], parallelSafe: true, priority: 80 },
      { id: 'read-b', title: 'Read B', objective: 'read B', dependsOn: [], completionCriteria: 'done', suggestedTools: ['read_file'], effect: 'read', resources: ['b'], parallelSafe: true, priority: 70 },
    ],
  }));
  await test.coordinator.start('budget governed graph', { ...config, orchestration: 'auto' }, 'key');
  const failed = await test.store.getLast();
  const graph = failed?.teamTask?.executionGraph;
  if (
    executorCalls !== 1 || failed?.status !== 'failed' || graph?.usage.requests !== 1 ||
    graph.nodes.filter((node) => node.status === 'completed').length !== 1 ||
    !graph.controlLog.some((entry) => entry.action === 'limit' && entry.reason.includes('请求预算'))
  ) {
    throw new Error('request budget did not cap execution and persist the terminal boundary');
  }
}

// A node timeout aborts only that worker and leaves a continuable DAG
// checkpoint instead of losing the already-reviewed Team task.
{
  let executorCalls = 0;
  const test = await fixture(async (_cfg, _session, _text, options) => {
    executorCalls += 1;
    await new Promise((resolve) => {
      if (options.signal.aborted) resolve();
      else options.signal.addEventListener('abort', resolve, { once: true });
    });
    return {
      status: 'cancelled',
      output: '',
      usage: { inputTokens: 0, outputTokens: 0, requests: 0 },
      result: { protocolVersion: 1, status: 'cancelled', reason: 'aborted', diagnostics: [], artifacts: [], usage: { inputTokens: 0, outputTokens: 0, requests: 0 } },
    };
  }, undefined, governedTeam({
    nodeTimeoutMs: 10,
    timeoutMs: 1_000,
    nodes: [
      { id: 'slow-read', title: 'Slow read', objective: 'read slowly', dependsOn: [], completionCriteria: 'done', suggestedTools: ['read_file'], effect: 'read', resources: ['source'], parallelSafe: true, priority: 50 },
    ],
  }));
  await test.coordinator.start('node timeout graph', { ...config, orchestration: 'auto' }, 'key');
  const paused = await test.store.getLast();
  if (
    executorCalls !== 1 || paused?.status !== 'paused' || paused.canContinue !== true ||
    paused.teamTask?.executionGraph?.nodes[0].status !== 'paused' ||
    !String(paused.error).includes('超过 10ms')
  ) {
    throw new Error('node timeout did not create a continuable graph checkpoint');
  }
}

// The global timeout is a hard terminal limit even when it expires while a
// node is running; it is distinct from a continuable node timeout.
{
  let executorCalls = 0;
  const test = await fixture(async (_cfg, _session, _text, options) => {
    executorCalls += 1;
    await new Promise((resolve) => {
      if (options.signal.aborted) resolve();
      else options.signal.addEventListener('abort', resolve, { once: true });
    });
    return {
      status: 'cancelled',
      output: '',
      usage: { inputTokens: 0, outputTokens: 0, requests: 1 },
      result: { protocolVersion: 1, status: 'cancelled', reason: 'aborted', diagnostics: [], artifacts: [], usage: { inputTokens: 0, outputTokens: 0, requests: 1 } },
    };
  }, undefined, governedTeam({
    nodeTimeoutMs: 1_000,
    timeoutMs: 10,
    nodes: [
      { id: 'global-slow', title: 'Global slow', objective: 'exceed task deadline', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }));
  await test.coordinator.start('global timeout graph', { ...config, orchestration: 'auto' }, 'key');
  const failed = await test.store.getLast();
  const graph = failed?.teamTask?.executionGraph;
  if (
    executorCalls !== 1 || failed?.status !== 'failed' || failed.canContinue ||
    graph?.status !== 'failed' || graph.usage.requests !== 1 ||
    !graph.controlLog.some((entry) => entry.action === 'limit' && entry.reason.includes('全局超时'))
  ) {
    throw new Error('global timeout did not stop the graph at a terminal persisted limit');
  }
}

// Verifier-directed retry reopens only the requested node and runs through a
// second verification pass under the graph retry limit.
{
  let executorCalls = 0;
  let verifierCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: `attempt ${executorCalls}`, usage, result: completedAgentResult(`attempt ${executorCalls}`) };
  }, undefined, governedTeam({
    maxRetries: 2,
    nodes: [
      { id: 'work', title: 'Work', objective: 'perform work', dependsOn: [], completionCriteria: 'verified', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }, async () => {
    verifierCalls += 1;
    if (verifierCalls === 1) {
      return { passed: false, decision: 'retry', retryNodeIds: ['work'], summary: 'evidence incomplete', evidence: [], gaps: ['missing proof'], nextAction: 'retry work' };
    }
    return { passed: true, decision: 'pass', summary: 'verified', evidence: ['proof'], gaps: [] };
  }));
  await test.coordinator.start('verifier retry graph', { ...config, orchestration: 'auto' }, 'key');
  const completed = await test.store.getLast();
  if (
    executorCalls !== 2 || verifierCalls !== 2 || completed?.status !== 'completed' ||
    completed.teamTask?.executionGraph?.retryCount !== 1 ||
    !completed.teamTask.executionGraph.controlLog.some((entry) => entry.action === 'retry')
  ) {
    throw new Error('verifier retry did not reopen, rerun and reverify the selected node');
  }
}

// A verifier may append or rewrite unfinished work, but completed nodes and
// the original budget/concurrency/timeout envelope remain immutable.
{
  let executorCalls = 0;
  let verifierCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: `revised attempt ${executorCalls}`, usage, result: completedAgentResult(`revised attempt ${executorCalls}`) };
  }, undefined, governedTeam({
    maxParallelism: 1,
    budget: { maxRequests: 3 },
    timeoutMs: 1_000,
    nodeTimeoutMs: 500,
    maxRetries: 2,
    nodes: [
      { id: 'inspect', title: 'Inspect', objective: 'inspect', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 80 },
      { id: 'apply', title: 'Apply', objective: 'apply', dependsOn: ['inspect'], completionCriteria: 'done', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }, async () => {
    verifierCalls += 1;
    if (verifierCalls === 1) {
      return {
        passed: false,
        decision: 'revise',
        summary: 'confirmation step required',
        evidence: [],
        gaps: ['missing confirmation'],
        revisedGraph: {
          maxParallelism: 4,
          budget: { maxRequests: 100 },
          timeoutMs: 10_000,
          nodeTimeoutMs: 5_000,
          maxRetries: 5,
          nodes: [
            { id: 'inspect', title: 'Inspect', objective: 'inspect', dependsOn: [], completionCriteria: 'done', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 80 },
            { id: 'apply', title: 'Apply', objective: 'apply', dependsOn: ['inspect'], completionCriteria: 'done', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
            { id: 'confirm', title: 'Confirm', objective: 'confirm result', dependsOn: ['apply'], completionCriteria: 'confirmed', suggestedTools: [], effect: 'read', resources: ['source'], parallelSafe: true, priority: 60 },
          ],
        },
      };
    }
    return { passed: true, decision: 'pass', summary: 'verified', evidence: ['confirmed'], gaps: [] };
  }));
  await test.coordinator.start('verifier revise graph', { ...config, orchestration: 'auto' }, 'key');
  const completed = await test.store.getLast();
  const graph = completed?.teamTask?.executionGraph;
  if (
    executorCalls !== 3 || verifierCalls !== 2 || completed?.status !== 'completed' ||
    graph?.nodes.find((node) => node.id === 'inspect')?.status !== 'completed' ||
    graph.nodes.find((node) => node.id === 'confirm')?.status !== 'completed' ||
    graph.maxParallelism !== 1 || graph.budget.maxRequests !== 3 || graph.timeoutMs !== 1_000 ||
    graph.nodeTimeoutMs !== 500 || graph.maxRetries !== 2 ||
    !graph.controlLog.some((entry) => entry.action === 'revise')
  ) {
    throw new Error('controlled graph revision changed completed work or widened its governance envelope');
  }
}

// Verifier questions are persisted as approval checkpoints. Accepting the
// question applies the bounded retry and resumes the same durable run.
{
  let executorCalls = 0;
  let verifierCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: `question attempt ${executorCalls}`, usage, result: completedAgentResult(`question attempt ${executorCalls}`) };
  }, undefined, governedTeam({
    maxRetries: 2,
    nodes: [
      { id: 'work', title: 'Work', objective: 'perform work', dependsOn: [], completionCriteria: 'confirmed', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }, async () => {
    verifierCalls += 1;
    if (verifierCalls === 1) {
      return {
        passed: false,
        decision: 'ask_user',
        questionAction: 'retry',
        retryNodeIds: ['work'],
        userQuestion: 'Retry the incomplete work?',
        summary: 'user confirmation required',
        evidence: [],
        gaps: ['confirmation'],
      };
    }
    return { passed: true, decision: 'pass', summary: 'verified', evidence: ['confirmed'], gaps: [] };
  }));
  await test.coordinator.start('verifier question graph', { ...config, orchestration: 'auto' }, 'key');
  const waiting = await test.store.getLast();
  const approval = waiting?.approvals[0];
  if (waiting?.status !== 'awaiting_approval' || !approval || approval.name !== 'team_verification') {
    throw new Error('verifier question was not persisted as an approval checkpoint');
  }
  await test.coordinator.approve(waiting.id, approval.id, true, 'key');
  const completed = await test.store.getLast();
  if (executorCalls !== 2 || verifierCalls !== 2 || completed?.status !== 'completed' || completed.teamTask?.pendingVerification) {
    throw new Error('approved verifier question did not resume and complete the durable Team run');
  }
}

// Rejecting a verifier question is a user refusal, not a system error, and
// clears the synthetic approval checkpoint without executing another node.
{
  let executorCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return { status: 'completed', output: 'needs confirmation', usage, result: completedAgentResult('needs confirmation') };
  }, undefined, governedTeam({
    nodes: [
      { id: 'work', title: 'Work', objective: 'perform work', dependsOn: [], completionCriteria: 'confirmed', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }, async () => ({
    passed: false,
    decision: 'ask_user',
    questionAction: 'retry',
    retryNodeIds: ['work'],
    userQuestion: 'Retry the incomplete work?',
    summary: 'user confirmation required',
    evidence: [],
    gaps: ['confirmation'],
  })));
  await test.coordinator.start('reject verifier question', { ...config, orchestration: 'auto' }, 'key');
  const waiting = await test.store.getLast();
  const approval = waiting?.approvals[0];
  if (!waiting || !approval) throw new Error('verifier refusal test did not reach approval');
  await test.coordinator.approve(waiting.id, approval.id, false, 'key');
  const refused = await test.store.getLast();
  if (
    executorCalls !== 1 || refused?.status !== 'refused' || refused.error !== undefined ||
    refused.teamTask?.pendingVerification !== undefined
  ) {
    throw new Error('rejected verifier question was not persisted as a clean user refusal');
  }
}

// Once the graph's adjustment allowance is exhausted, verifier ask_user must
// fail deterministically instead of presenting an approval that cannot run.
{
  const test = await fixture(async () => ({
    status: 'completed', output: 'unverified', usage, result: completedAgentResult('unverified'),
  }), undefined, governedTeam({
    maxRetries: 0,
    nodes: [
      { id: 'work', title: 'Work', objective: 'perform work', dependsOn: [], completionCriteria: 'confirmed', suggestedTools: [], effect: 'none', resources: [], parallelSafe: true, priority: 50 },
    ],
  }, async () => ({
    passed: false,
    decision: 'ask_user',
    questionAction: 'retry',
    retryNodeIds: ['work'],
    userQuestion: 'Retry?',
    summary: 'still incomplete',
    evidence: [],
    gaps: ['proof'],
  })));
  await test.coordinator.start('exhausted verifier question', { ...config, orchestration: 'auto' }, 'key');
  const failed = await test.store.getLast();
  if (
    failed?.status !== 'failed' || failed.approvals.length !== 0 ||
    failed.teamTask?.executionGraph?.status !== 'failed' ||
    !failed.teamTask.executionGraph.controlLog.some((entry) => entry.action === 'limit')
  ) {
    throw new Error('exhausted verifier question exposed an unusable approval');
  }
}

// A model-routed Team is durable and serial: planner and reviewer must finish
// before the existing executor runs, and verifier decides the final outcome.
{
  const calls = [];
  const test = await fixture(async (_cfg, _session, _text, options) => {
    calls.push('executor');
    if (!options.teamTask || options.teamTask.nodes[1].status !== 'completed') {
      throw new Error('executor received an unreviewed Team task');
    }
    return {
      status: 'completed',
      output: 'workspace change completed',
      usage,
      result: completedAgentResult('workspace change completed'),
    };
  }, undefined, {
    routeTeamTask: async () => {
      calls.push('route');
      return createTeamTask({
        route: 'team',
        goal: 'Complete a complex workspace change',
        reason: 'Needs planning, review, execution and verification',
        planSummary: 'Inspect, change, then verify',
        reviewFocus: ['scope'],
        verificationCriteria: ['evidence is present'],
      }, 'Complete a complex workspace change');
    },
    planTeamTask: async () => {
      calls.push('planner');
      return {
        planSummary: 'Inspect current state, make change, verify output',
        reviewFocus: ['scope and approval'],
        verificationCriteria: ['real evidence confirms the change'],
      };
    },
    reviewTeamTask: async () => {
      calls.push('reviewer');
      return { approved: true, summary: 'approved', findings: ['scope bounded'], requiredChanges: [] };
    },
    verifyTeamTask: async () => {
      calls.push('verifier');
      return { passed: true, summary: 'verified', evidence: ['workspace change completed'], gaps: [] };
    },
  });
  await test.coordinator.start('Complete a complex workspace change', { ...config, orchestration: 'auto' }, 'key');
  const completed = await test.store.getLast();
  if (
    calls.join(',') !== 'route,planner,reviewer,executor,verifier' ||
    completed?.status !== 'completed' ||
    completed.teamTask?.status !== 'completed' ||
    completed.teamTask.nodes.some((node) => node.status !== 'completed')
  ) {
    throw new Error('model-routed Team was not persisted and completed serially');
  }
}

// If the executor receives a retryable gateway failure before the SDK exposes
// RunState, continue preserves planner/reviewer and restarts at executor.
{
  let routeCalls = 0;
  let plannerCalls = 0;
  let reviewerCalls = 0;
  let executorCalls = 0;
  let verifierCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    if (executorCalls === 1) throw Object.assign(new Error('502 gateway unavailable'), { status: 502 });
    return {
      status: 'completed',
      output: 'resumed change completed',
      usage,
      result: completedAgentResult('resumed change completed'),
    };
  }, undefined, {
    routeTeamTask: async () => {
      routeCalls += 1;
      return createTeamTask({
        route: 'team',
        goal: 'Resume a complex task',
        reason: 'Needs separate roles',
        planSummary: 'Execute task',
        reviewFocus: [],
        verificationCriteria: ['task completed'],
      }, 'Resume a complex task');
    },
    planTeamTask: async () => {
      plannerCalls += 1;
      return { planSummary: 'Execute task', reviewFocus: [], verificationCriteria: ['task completed'] };
    },
    reviewTeamTask: async () => {
      reviewerCalls += 1;
      return { approved: true, summary: 'approved', findings: [], requiredChanges: [] };
    },
    verifyTeamTask: async () => {
      verifierCalls += 1;
      return { passed: true, summary: 'verified', evidence: ['resumed change completed'], gaps: [] };
    },
  });
  await test.coordinator.start('Resume a complex task', { ...config, orchestration: 'auto' }, 'key');
  const paused = await test.store.getLast();
  if (
    paused?.status !== 'paused' ||
    paused.teamTask?.nodes[0].status !== 'completed' ||
    paused.teamTask.nodes[1].status !== 'completed' ||
    paused.teamTask.nodes[2].status !== 'running'
  ) {
    throw new Error('Team gateway failure did not preserve executor boundary');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (
    routeCalls !== 1 || plannerCalls !== 1 || reviewerCalls !== 1 ||
    executorCalls !== 2 || verifierCalls !== 1 ||
    completed?.status !== 'completed' || completed.teamTask?.status !== 'completed'
  ) {
    throw new Error('Team continuation replayed completed roles or missed verification');
  }
}

// A verifier gateway failure must not replay the already-completed executor:
// continue resumes only the durable verification node.
{
  let executorCalls = 0;
  let verifierCalls = 0;
  const test = await fixture(async () => {
    executorCalls += 1;
    return {
      status: 'completed',
      output: 'executor evidence',
      usage,
      result: completedAgentResult('executor evidence'),
    };
  }, undefined, {
    routeTeamTask: async () => createTeamTask({
      route: 'team',
      goal: 'Verify a complex task',
      reason: 'Requires separate verification',
      planSummary: 'Execute and verify',
      reviewFocus: [],
      verificationCriteria: ['verified'],
    }, 'Verify a complex task'),
    planTeamTask: async () => ({ planSummary: 'Execute and verify', reviewFocus: [], verificationCriteria: ['verified'] }),
    reviewTeamTask: async () => ({ approved: true, summary: 'approved', findings: [], requiredChanges: [] }),
    verifyTeamTask: async () => {
      verifierCalls += 1;
      if (verifierCalls === 1) throw Object.assign(new Error('502 verifier gateway unavailable'), { status: 502 });
      return { passed: true, summary: 'verified', evidence: ['executor evidence'], gaps: [] };
    },
  });
  await test.coordinator.start('Verify a complex task', { ...config, orchestration: 'auto' }, 'key');
  const paused = await test.store.getLast();
  if (
    paused?.status !== 'paused' ||
    paused.teamTask?.nodes[2].status !== 'completed' ||
    paused.teamTask.nodes[3].status !== 'running'
  ) {
    throw new Error('verifier failure did not preserve completed executor evidence');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (executorCalls !== 1 || verifierCalls !== 2 || completed?.teamTask?.status !== 'completed') {
    throw new Error('verifier continuation replayed the executor');
  }
}

// Stopping during the planner call aborts planning, creates no agent call, and
// leaves the already-created run resumable from its safe boundary.
{
  let agentCalls = 0;
  let plannerAborted = false;
  let plannerStartedResolve;
  const plannerStarted = new Promise((resolve) => { plannerStartedResolve = resolve; });
  const test = await fixture(async () => {
    agentCalls += 1;
    return { status: 'completed', output: 'unexpected', usage };
  }, async (_cfg, _text, signal) => {
    plannerStartedResolve();
    await new Promise((resolve, reject) => signal.addEventListener('abort', () => {
      plannerAborted = true;
      reject(Object.assign(new Error('planning aborted'), { name: 'AbortError' }));
    }, { once: true }));
  });
  const starting = test.coordinator.start('stop planning', config, 'key');
  await plannerStarted;
  await test.coordinator.stop();
  await starting;
  const paused = await test.store.getLast();
  if (!plannerAborted || agentCalls !== 0 || paused?.status !== 'paused' || !paused.canContinue) {
    throw new Error('stop during planning did not preserve a safe continuation');
  }
}

// An immediate manual stop can happen before the SDK exposes a RunState. The
// coordinator rolls back the partial turn and safely restarts it on continue.
{
  let calls = 0;
  const initialStates = [];
  const test = await fixture(async (_cfg, session, userText, options) => {
    calls += 1;
    initialStates.push(options.initialState);
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    if (calls === 1) {
      await new Promise((resolve) => options.signal.addEventListener('abort', resolve, { once: true }));
      return { status: 'cancelled', output: '', usage };
    }
    await session.addItems([{
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'continued safely' }],
    }]);
    return { status: 'completed', output: 'continued safely', usage };
  });
  const running = test.coordinator.start('cancel me', config, 'key');
  await new Promise((resolve) => setTimeout(resolve, 10));
  await test.coordinator.initialize();
  if (!test.events.some((event) => event.type === 'runAttached')) throw new Error('live run was mistaken for a crash');
  await test.coordinator.stop();
  await running;
  if (!test.events.some((event) => event.type === 'agentEvent' && event.event.type === 'run.started')) {
    throw new Error('stable run.started protocol event missing');
  }
  if ((await test.session.getItems()).length !== 0) throw new Error('coordinator did not rollback the early-stop session');
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.canContinue !== true || paused.state !== undefined) {
    throw new Error('early stop was not persisted as a safe continuation');
  }
  if (!test.events.some((event) => event.type === 'paused' && event.resumeStrategy === 'safe_restart')) {
    throw new Error('safe-restart pause event missing');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (
    completed?.status !== 'completed' ||
    completed.id === paused.id ||
    completed.operationId !== paused.operationId ||
    initialStates[1] !== undefined
  ) {
    throw new Error('early-stop continue did not restart from the safe boundary');
  }
}

// A transient gateway failure keeps the SDK state and can resume without
// replaying the original task.
{
  const initialStates = [];
  let calls = 0;
  const test = await fixture(async (_cfg, session, userText, options) => {
    calls += 1;
    initialStates.push(options.initialState);
    if (calls === 1) {
      await session.addItems([{ type: 'message', role: 'user', content: userText }]);
      throw Object.assign(new Error('502 {"detail":"Model gateway is unavailable"}'), {
        status: 502,
        agentRunState: '{"sdk":"gateway-checkpoint"}',
      });
    }
    return { status: 'completed', output: 'gateway recovered', usage };
  });
  await test.coordinator.start('gateway state resume', config, 'key');
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.state !== '{"sdk":"gateway-checkpoint"}' || !paused.canContinue) {
    throw new Error('retryable gateway state was not preserved');
  }
  if ((await test.session.getItems()).length !== 1) {
    throw new Error('session was rolled back despite a resumable gateway state');
  }
  if (!test.events.some((event) => event.type === 'error' && event.canContinue === true)) {
    throw new Error('recoverable gateway error did not expose continue');
  }
  await test.coordinator.continue('key');
  if (initialStates[1] !== '{"sdk":"gateway-checkpoint"}' || (await test.store.getLast())?.status !== 'completed') {
    throw new Error('gateway failure did not resume from SDK state');
  }
}

// A retryable failure without a serializable state falls back to the safe
// session boundary and keeps the operation lineage for side-effect recovery.
{
  let calls = 0;
  const test = await fixture(async (_cfg, session, userText) => {
    calls += 1;
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    if (calls === 1) {
      throw Object.assign(new Error('fetch failed'), { code: 'ECONNRESET' });
    }
    return { status: 'completed', output: 'connection recovered', usage };
  });
  await test.coordinator.start('gateway boundary resume', config, 'key');
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.state !== undefined || !paused.canContinue) {
    throw new Error('state-less gateway failure was not preserved for safe continuation');
  }
  if ((await test.session.getItems()).length !== 0) {
    throw new Error('state-less gateway failure did not rollback its partial session');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (completed?.status !== 'completed' || completed.id === paused.id || completed.operationId !== paused.operationId) {
    throw new Error('state-less gateway failure did not restart safely');
  }
}

// Runs persisted by the previous build as failed should also recognize a 502
// message and become continuable after the extension is updated.
{
  const test = await fixture(async () => ({ status: 'completed', output: 'legacy recovered', usage }));
  const legacy = await test.store.begin('legacy gateway failure', config, 0, 'legacy-gateway-op');
  legacy.status = 'failed';
  legacy.error = 'Error: 502 {"detail":"Model gateway is unavailable"}';
  await test.store.update(legacy);
  await test.coordinator.initialize();
  if (!test.events.some((event) => event.type === 'retryState' && event.canContinue === true)) {
    throw new Error('legacy retryable failure was not exposed as continuable');
  }
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (completed?.status !== 'completed' || completed.operationId !== legacy.operationId) {
    throw new Error('legacy gateway failure could not continue from its safe boundary');
  }
}

// A legacy retryable failed record with stale SDK state must use the safe
// boundary instead of calling RunStore.resume(), which only accepts paused runs.
{
  const initialStates = [];
  const test = await fixture(async (_cfg, _session, _text, options) => {
    initialStates.push(options.initialState);
    return { status: 'completed', output: 'legacy state recovered', usage };
  });
  const legacy = await test.store.begin('legacy state gateway failure', config, 0, 'legacy-state-op');
  legacy.status = 'failed';
  legacy.state = '{"stale":true}';
  legacy.error = 'Error: 502 gateway unavailable';
  await test.store.update(legacy);
  await test.coordinator.continue('key');
  const completed = await test.store.getLast();
  if (completed?.status !== 'completed' || completed.operationId !== legacy.operationId || initialStates[0] !== undefined) {
    throw new Error('legacy failed state did not use safe continuation');
  }
}

// A manual stop preserves the SDK checkpoint; continue resumes that exact
// state instead of replaying the user's text from the beginning.
{
  const initialStates = [];
  let startedResolve;
  const started = new Promise((resolve) => {
    startedResolve = resolve;
  });
  let call = 0;
  const test = await fixture(async (_cfg, session, userText, options) => {
    call += 1;
    initialStates.push(options.initialState);
    if (call === 1) {
      await session.addItems([{ type: 'message', role: 'user', content: userText }]);
      startedResolve();
      await new Promise((resolve) => options.signal.addEventListener('abort', resolve, { once: true }));
      return { status: 'cancelled', output: 'partial', usage, state: '{"sdk":"checkpoint"}' };
    }
    return { status: 'completed', output: 'continued', usage };
  });
  const running = test.coordinator.start('resume me', config, 'key');
  await started;
  await test.coordinator.stop();
  await running;
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.canContinue !== true || paused.state !== '{"sdk":"checkpoint"}') {
    throw new Error('manual stop did not persist a continuable checkpoint');
  }
  await test.coordinator.continue('key', '继续');
  const resumed = await test.store.getLast();
  if (initialStates[0] !== undefined || initialStates[1] !== '{"sdk":"checkpoint"}' || resumed?.status !== 'completed') {
    throw new Error('continue did not resume the saved checkpoint');
  }
  const resumeEvent = [...test.events].reverse().find((event) => event.type === 'resumeStarted');
  if (resumeEvent?.displayText !== '继续') {
    throw new Error('continue did not expose the typed continuation text for UI display');
  }
  const sessionItems = await test.session.getItems();
  if (sessionItems.some((item) => item?.type === 'message' && item?.role === 'user' && item?.content === '继续')) {
    throw new Error('typed continuation text leaked into model session history');
  }
}

// Stop can win the pre-controller startup window without allowing the model to run.
{
  let agentCalls = 0;
  const test = await fixture(async () => {
    agentCalls += 1;
    return { status: 'completed', output: 'unexpected', usage };
  });
  const starting = test.coordinator.start('instant stop', config, 'key');
  await test.coordinator.stop();
  await starting;
  if (agentCalls !== 0) throw new Error('stop raced with startup and still invoked the agent');
  const paused = await test.store.getLast();
  if (paused?.status !== 'paused' || paused.canContinue !== true) {
    throw new Error('pre-controller stop was not preserved for continuation');
  }
}

// Retry reuses operationId while getting a new attempt/run id.
{
  let call = 0;
  const test = await fixture(async (_cfg, session, userText) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    call += 1;
    if (call === 1) throw new Error('transient');
    await session.addItems([{
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: 'ok' }],
    }]);
    return { status: 'completed', output: 'ok', usage };
  });
  await test.coordinator.start('retry me', config, 'key');
  const failed = await test.store.getLast();
  if (failed?.status !== 'failed') throw new Error('failed run was not persisted');
  await test.coordinator.retry('key');
  const completed = await test.store.getLast();
  if (completed?.status !== 'completed' || completed.id === failed.id || completed.operationId !== failed.operationId) {
    throw new Error('retry identity contract is invalid');
  }
}

// Startup restores approvals, but rolls a crashed running turn back.
{
  const test = await fixture(async () => ({ status: 'completed', output: '', usage }));
  const waiting = await test.store.begin('approval', config, 0, 'approval-op');
  waiting.status = 'awaiting_approval';
  waiting.state = '{"state":true}';
  waiting.approvals = [{ id: 'call-1', name: 'write_file', args: '{}' }];
  await test.store.update(waiting);
  await test.coordinator.initialize();
  if (!test.events.some((event) => event.type === 'runRestored')) throw new Error('approval was not restored');

  await test.coordinator.stop(false);
  const running = await test.store.begin('crashed', config, 0, 'crash-op');
  await test.session.addItems([{ type: 'message', role: 'user', content: 'partial' }]);
  const freshEvents = [];
  const freshSession = new JsonFileSession(path.join(test.dir, 'session.json'));
  const fresh = new RunCoordinator({
    session: freshSession,
    store: new JsonRunStore(path.join(test.dir, 'runs.json')),
    emit: (event) => freshEvents.push(event),
  });
  await fresh.initialize();
  const recovered = await test.store.getLast();
  if (recovered?.id !== running.id || recovered.status !== 'failed') throw new Error('crashed run was not recovered');
  if ((await freshSession.getItems()).length !== 0) throw new Error('crashed run session was not rolled back');
  if (!freshEvents.some((event) => event.type === 'runRecovered')) throw new Error('recovery event missing');
}

// Startup history replays persisted protocol events so the UI can restore
// tool and approval cards, not just plain text bubbles.
{
  const test = await fixture(async (_cfg, session, userText, options) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    options.protocol.onEvent(options.protocol.eventFactory.next({
      type: 'tool.started',
      payload: {
        toolName: 'read_file',
        callId: 'call-history',
        arguments: JSON.stringify({ path: 'history.txt' }),
      },
    }));
    options.protocol.onEvent(options.protocol.eventFactory.next({
      type: 'tool.completed',
      payload: {
        toolName: 'read_file',
        callId: 'call-history',
        ok: true,
        summary: '已读取文件',
        result: {
          protocolVersion: 1,
          ok: true,
          data: { totalLines: 1, content: 'hello' },
          diagnostics: [],
          effect: 'none',
          risk: 'read',
        },
      },
    }));
    await session.addItems([{ type: 'message', role: 'assistant', content: '已读取 history.txt' }]);
    return { status: 'completed', output: '已读取 history.txt', usage };
  });
  await test.coordinator.start('读取 history.txt', config, 'key');
  const saved = await test.store.getLast();
  if (!saved?.events?.some((event) => event.type === 'tool.completed')) {
    throw new Error('protocol tool event was not persisted with the run');
  }
  const freshEvents = [];
  const fresh = new RunCoordinator({
    session: new JsonFileSession(path.join(test.dir, 'session.json')),
    store: new JsonRunStore(path.join(test.dir, 'runs.json')),
    emit: (event) => freshEvents.push(event),
  });
  await fresh.initialize();
  const history = freshEvents.find((event) => event.type === 'history');
  if (!history?.events?.some((event) => event.type === 'tool.completed')) {
    throw new Error('history did not include persisted protocol events');
  }
  if (!history.messages?.some((message) => message.text === '已读取 history.txt')) {
    throw new Error('history lost ordinary chat messages while restoring events');
  }
}

// Refusing an approval is a terminal user decision, not a system failure.
{
  const test = await fixture(async (_cfg, session, userText) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    return {
      status: 'refused',
      output: '',
      usage,
      result: {
        protocolVersion: 1,
        status: 'refused',
        reason: '用户拒绝了工具调用: write_file',
        diagnostics: [],
        artifacts: [],
        usage,
      },
    };
  });
  await test.coordinator.start('拒绝写文件', config, 'key');
  const refused = await test.store.getLast();
  if (refused?.status !== 'refused') throw new Error('refused run was not persisted');
  if (refused?.error !== undefined) throw new Error('refused run was incorrectly marked as an error');
  if ((await test.session.getItems()).length !== 0) throw new Error('refused session was not rolled back');
  if (!test.events.some((event) => event.type === 'refused')) throw new Error('refused runtime event missing');
  if (!test.events.some((event) => event.type === 'agentEvent' && event.event.type === 'run.refused')) {
    throw new Error('run.refused protocol event missing');
  }
}

// Clear owns the final boundary: a late run completion cannot restore the old
// session or leave a retryable run behind after the user starts a new session.
{
  let releaseAgent;
  let sessionWriteStarted;
  const sessionWrite = new Promise((resolve) => {
    sessionWriteStarted = resolve;
  });
  const agentGate = new Promise((resolve) => {
    releaseAgent = resolve;
  });
  const test = await fixture(async (_cfg, session, userText) => {
    await session.addItems([{ type: 'message', role: 'user', content: userText }]);
    sessionWriteStarted();
    await agentGate;
    return { status: 'completed', output: 'late result', usage };
  });

  const running = test.coordinator.start('old session', config, 'key');
  await sessionWrite;
  const clearing = test.coordinator.clear();
  releaseAgent();
  await Promise.all([running, clearing]);
  if ((await test.session.getItems()).length !== 0) throw new Error('clear lost to a late run session write');
  if ((await test.store.getLast()) !== undefined) throw new Error('clear left a stale run for retry');
  if (!test.events.some((event) => event.type === 'cleared')) throw new Error('clear event missing');
}

// A stop that already read the active run but has not started rollback yet is
// absorbed by clear(); it must not resurrect the run after clearRuns().
{
  const test = await fixture(async () => ({ status: 'completed', output: '', usage }));
  await test.store.begin('pending stop', config, 0);
  let releaseActiveRead;
  let activeReadStarted;
  const activeRead = new Promise((resolve) => {
    activeReadStarted = resolve;
  });
  const activeReadGate = new Promise((resolve) => {
    releaseActiveRead = resolve;
  });
  const originalGetActive = test.store.getActive.bind(test.store);
  let readCount = 0;
  test.store.getActive = async () => {
    const active = await originalGetActive();
    readCount += 1;
    if (readCount === 1) {
      activeReadStarted();
      await activeReadGate;
    }
    return active;
  };
  const stopping = test.coordinator.stop(false);
  await activeRead;
  const clearing = test.coordinator.clear();
  releaseActiveRead();
  await Promise.all([stopping, clearing]);
  if ((await test.store.getLast()) !== undefined) throw new Error('late stop rollback resurrected a cleared run');
}

console.log('run coordinator tests passed: cancel rollback, retry identity, approval/crash recovery, refusal terminal state, clear races');
