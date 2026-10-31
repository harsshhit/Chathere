import {
  estimateDocumentBytes,
  getMessagesToAppend,
  removeUndefinedValues,
} from "./chatMessageWrites";

describe("removeUndefinedValues", () => {
  it("removes undefined object properties recursively and preserves array positions", () => {
    expect(removeUndefinedValues({
      name: "ChatHere",
      omitted: undefined,
      nested: { retained: true, omitted: undefined },
      members: [{ uid: "user-1", displayName: undefined }, undefined],
    })).toEqual({
      name: "ChatHere",
      nested: { retained: true },
      members: [{ uid: "user-1" }, null],
    });
  });
});

describe("estimateDocumentBytes", () => {
  it("measures UTF-8 serialized document data", () => {
    expect(estimateDocumentBytes({ text: "hello" })).toBe(16);
    expect(estimateDocumentBytes({ text: "é" })).toBe(13);
  });
});

describe("getMessagesToAppend", () => {
  it("does not return messages whose IDs are already in the chat", () => {
    expect(getMessagesToAppend(
      [{ id: "existing", text: "old" }],
      [{ id: "existing", text: "duplicate" }, { id: "new", text: "next" }]
    )).toEqual([{ id: "new", text: "next" }]);
  });

  it("ignores invalid candidates and nullish chat state", () => {
    expect(getMessagesToAppend(null, [undefined, { id: "new", text: "next" }, { text: "missing" }]))
      .toEqual([{ id: "new", text: "next" }]);
  });
});
