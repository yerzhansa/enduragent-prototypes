import type { FormEvent, RefObject } from "react";
import type { AnswerKey, Command, Legacy, Premise, Preview, State } from "./types";

export type EditorKey = AnswerKey | "change" | "supporting";
export type FormValues = Record<string, string | string[]>;
export type EvidenceSource = Premise[] | Preview | Legacy | Record<string, string>;
export interface CatalogueUi {
  theme: "light" | "dark";
  width: "wide" | "compact";
  editor: EditorKey | null;
  values: FormValues;
  how: boolean;
  editHub: boolean;
  context: boolean;
  source: EvidenceSource | null;
  error: string;
  contextDrawer?: boolean;
  reduced?: boolean;
  daily?: boolean;
  pausedEditor?: { key: EditorKey | null; values: FormValues } | null;
  planDetails?: string | null;
  lastCommand?: Command | null;
  commandSerial?: number;
  dialogFocus?: string | null;
  restoreText?: string | null;
  focus?: string | null;
}
export type CatalogueAction =
  | Command
  | (
      | {
          ui:
            | "reset"
            | "finish-build"
            | "replay"
            | "retired-apply"
            | "older-result"
            | "refresh-preview"
            | "fresh-evidence"
            | "back-editor"
            | "edit-hub"
            | "leave-hub"
            | "context"
            | "close-source"
            | "daily"
            | "send";
        }
      | { ui: "plan-details"; id: string }
      | { ui: "editor"; key: EditorKey }
      | { ui: "source"; value?: EvidenceSource }
    );
export interface CatalogueSnapshot {
  state: State;
  ui: CatalogueUi;
  selected: string;
  variation: string;
  revision: number;
}
export interface CatalogueViewContext extends CatalogueSnapshot {
  run: (action: CatalogueAction) => void;
  onFormInput: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (event: FormEvent<HTMLFormElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  composerRef: RefObject<HTMLTextAreaElement | null>;
}
