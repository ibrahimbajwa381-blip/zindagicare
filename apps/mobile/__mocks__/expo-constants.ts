export enum ExecutionEnvironment {
  Bare = "bare",
  Standalone = "standalone",
  StoreClient = "storeClient",
}

const Constants = {
  executionEnvironment: ExecutionEnvironment.StoreClient,
  expoConfig: {
    extra: {
      apiUrl: "http://localhost:3000",
      router: {},
      eas: { projectId: "test-project-id" },
    },
  },
  platform: {},
};

export default Constants;
