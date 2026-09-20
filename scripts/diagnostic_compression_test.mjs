import assert from "node:assert/strict";
import {
  compressDiagnostics,
  repairPacketToProtocolDiagnostics,
} from "./agent.testbundle.mjs";

const source = [
  "PROGRAM PumpControl",
  "VAR",
  "  Pump1Run : BOOL := FALSE;",
  "  Pump2Run : BOOL := FALSE;",
  "END_VAR",
  "Pump1Run := TRUE",
  "END_PROGRAM",
].join("\n");

{
  const packet = compressDiagnostics({
    toolName: "validate_st_code",
    diagnostics: [
      {
        severity: "warning",
        code: "st_unused_var",
        message: "Unused variable",
        path: "PumpControl.st",
        line: 3,
        character: 3,
        endLine: 3,
        endCharacter: 10,
      },
      {
        severity: "error",
        code: "st_parse_error",
        message: "Expecting token of type END_PROGRAM but found EOF",
        path: "PumpControl.st",
        line: 6,
        character: 17,
        endLine: 6,
        endCharacter: 17,
      },
      {
        severity: "error",
        code: "st_parse_error",
        message: "Expecting token of type END_PROGRAM but found EOF",
        path: "PumpControl.st",
        line: 6,
        character: 17,
        endLine: 6,
        endCharacter: 17,
      },
    ],
    sources: [{ path: "PumpControl.st", text: source }],
    maxDiagnostics: 2,
    snippetRadius: 1,
  });

  assert.equal(packet.errorCount, 2);
  assert.equal(packet.warningCount, 1);
  assert.equal(packet.duplicateCount, 1);
  assert.equal(packet.diagnostics.length, 2);
  assert.equal(packet.diagnostics[0].severity, "error");
  assert.equal(packet.diagnostics[0].occurrenceCount, 2);
  assert.match(packet.diagnostics[0].snippet?.text ?? "", /> 6: Pump1Run := TRUE/);
}

{
  const packet = compressDiagnostics({
    toolName: "compile_st",
    diagnostics: [{
      severity: "error",
      code: "long_message",
      message: `prefix ${"x".repeat(1000)} suffix`,
      path: "Long.st",
      line: 1,
      character: 1,
      endLine: 1,
      endCharacter: 2,
    }],
    sources: [{ path: "Long.st", text: "PROGRAM Long\nEND_PROGRAM" }],
    maxMessageChars: 80,
    maxTotalChars: 900,
  });

  assert.ok(packet.diagnostics[0].message.length <= 80);
  assert.equal(packet.diagnostics[0].snippet?.startLine, 1);
  assert.equal(packet.diagnostics[0].snippet?.endLine, 2);
  assert.ok(JSON.stringify(packet).length <= 900);
}

{
  const packet = compressDiagnostics({
    toolName: "validate_st_code",
    diagnostics: Array.from({ length: 12 }, (_, index) => ({
      severity: "error",
      code: `E${index}`,
      message: `Error ${index}`,
      path: "Many.st",
      line: index + 1,
      character: 1,
      endLine: index + 1,
      endCharacter: 2,
    })),
    sources: [{ path: "Many.st", text: Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n") }],
    maxDiagnostics: 4,
  });

  assert.equal(packet.diagnostics.length, 4);
  assert.equal(packet.omittedCount, 8);
  assert.equal(packet.truncated, true);
}

{
  const packet = compressDiagnostics({
    toolName: "validate_st_code",
    diagnostics: [{
      severity: "error",
      code: "edge",
      message: "First line issue",
      path: "Edge.st",
      line: 1,
      character: 1,
      endLine: 1,
      endCharacter: 2,
    }],
    sources: [{ path: "Edge.st", text: "first\nsecond\nthird" }],
    snippetRadius: 4,
  });

  assert.equal(packet.diagnostics[0].snippet?.startLine, 1);
  assert.equal(packet.diagnostics[0].snippet?.endLine, 3);
  const protocolDiagnostics = repairPacketToProtocolDiagnostics(packet);
  assert.equal(protocolDiagnostics.length, 1);
  assert.equal(protocolDiagnostics[0].severity, "error");
  assert.equal(protocolDiagnostics[0].details?.repairPacket, true);
}

console.log("[diagnostic_compression_test] ok");
