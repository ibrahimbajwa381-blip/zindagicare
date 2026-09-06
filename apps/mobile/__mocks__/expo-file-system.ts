export const Paths = { cache: { uri: "file://cache/" } };

export class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = "file://cache/";
  }
}

export class File {
  uri: string;
  constructor(...parts: unknown[]) {
    const last = parts[parts.length - 1];
    this.uri = `file://cache/${typeof last === "string" ? last : "file"}`;
  }

  static downloadFileAsync = jest.fn(async (_url: string, destination: File) => destination);

  static createDownloadTask = jest.fn((_url: string, destination: File) => ({
    downloadAsync: jest.fn(async () => destination),
  }));
}
