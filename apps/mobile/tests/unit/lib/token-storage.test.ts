import { getStoredTokens, setStoredTokens, clearStoredTokens } from "@/lib/token-storage";
import * as SecureStore from "expo-secure-store";

describe("token-storage", () => {
  beforeEach(async () => {
    await clearStoredTokens();
  });

  it("returns nulls when nothing is stored", async () => {
    const tokens = await getStoredTokens();
    expect(tokens).toEqual({ accessToken: null, refreshToken: null });
  });

  it("stores and retrieves both tokens", async () => {
    await setStoredTokens("access-1", "refresh-1");
    expect(await getStoredTokens()).toEqual({ accessToken: "access-1", refreshToken: "refresh-1" });
  });

  it("clears both tokens", async () => {
    await setStoredTokens("access-1", "refresh-1");
    await clearStoredTokens();
    expect(await getStoredTokens()).toEqual({ accessToken: null, refreshToken: null });
  });

  it("uses SecureStore under fixed key names", async () => {
    await setStoredTokens("access-1", "refresh-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("zc_access_token", "access-1");
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith("zc_refresh_token", "refresh-1");
  });
});
