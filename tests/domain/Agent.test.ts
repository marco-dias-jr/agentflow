import { describe, expect, it } from "vitest";
import { Agent } from "../../apps/api/src/domain/entities/Agent";
import { Execution } from "../../apps/api/src/domain/entities/Execution";

describe("Agent domain entity", () => {
  it("creates an agent with trimmed fields and deduplicated tools", () => {
    const agent = Agent.create({
      id: "agent-1",
      name: "  Support Assistant  ",
      description: " Technical helper ",
      systemPrompt: " You are helpful. ",
      model: "gemini-2.5-flash",
      enabledTools: ["calculator", "calculator", "knowledge_search", "  "],
    });

    expect(agent.name).toBe("Support Assistant");
    expect(agent.description).toBe("Technical helper");
    expect(agent.systemPrompt).toBe("You are helpful.");
    expect(agent.enabledTools).toEqual(["calculator", "knowledge_search"]);
  });

  it("throws an error when systemPrompt is missing", () => {
    expect(() =>
      Agent.create({
        id: "agent-1",
        name: "Support Assistant",
        description: "",
        systemPrompt: "   ",
        model: "gemini-2.5-flash",
        enabledTools: [],
      })
    ).toThrow("Agent systemPrompt is required.");
  });
});

describe("Execution domain entity", () => {
  it("records trace steps and completes execution with response", () => {
    const execution = Execution.start({
      id: "exec-1",
      agentId: "agent-1",
      provider: "gemini",
      model: "gemini-2.5-flash",
      prompt: "What is 2 + 2?",
    });

    expect(execution.status).toBe("running");
    expect(execution.trace).toHaveLength(1);
    expect(execution.trace[0].type).toBe("user_message");

    execution.addTraceStep("tool_call", "Requested calculator");
    execution.complete("4");

    expect(execution.status).toBe("completed");
    expect(execution.response).toBe("4");
    expect(execution.completedAt).toBeInstanceOf(Date);
    expect(execution.trace).toHaveLength(3);
  });
});
