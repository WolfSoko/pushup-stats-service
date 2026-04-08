export interface FeedbackDialogData {
  name?: string;
  email?: string;
}

export interface FeedbackResult {
  name: string;
  email: string;
  message: string;
  anonymous: boolean;
}
