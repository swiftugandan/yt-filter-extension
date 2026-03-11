// Augment chrome-types with missing APIs
declare namespace chrome.offscreen {
  export function hasDocument(): Promise<boolean>;
}

declare namespace chrome.runtime {
  export const lastError: { message?: string } | undefined;

  // Callback overload for sendMessage
  export function sendMessage(
    message: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseCallback: (response: any) => void,
  ): void;
}

declare namespace chrome.tabs {
  // Callback overload for sendMessage
  export function sendMessage(
    tabId: number,
    message: unknown,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseCallback: (response: any) => void,
  ): void;
}
