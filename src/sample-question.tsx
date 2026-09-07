import { useState } from "react";
import {
  Button,
  QuestionCard,
  QuestionOptions,
  QuestionOption,
  QuestionEditor,
  QuestionInput,
  RecordedAnswer,
} from "@enduragent/ui";

export function SampleQuestion({
  onAnswer,
}: {
  readonly onAnswer?: (answer: string | null) => void;
}) {
  const [answer, setAnswer] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  function record(value: string) {
    setAnswer(value);
    setEditing(false);
    onAnswer?.(value);
  }
  return answer !== null ? (
    <RecordedAnswer
      title="Weekly time recorded"
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAnswer(null);
            onAnswer?.(null);
            setDraft(answer);
          }}
        >
          Edit
        </Button>
      }
    >
      {answer}
    </RecordedAnswer>
  ) : (
    <QuestionCard
      title="How much time can you ride each week?"
      titleId="weekly-time-question"
      eyebrow="Weekly time"
    >
      {editing ? (
        <QuestionEditor>
          <QuestionInput
            aria-label="Your weekly time"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={!draft.trim()} onClick={() => record(draft.trim())}>
              Use answer
            </Button>
          </div>
        </QuestionEditor>
      ) : (
        <QuestionOptions>
          <QuestionOption
            marker="1"
            label="4 hours"
            description="A shorter week."
            onClick={() => record("4 hours")}
          />
          <QuestionOption
            marker="2"
            label="6 hours"
            description="More time for longer rides."
            onClick={() => record("6 hours")}
          />
          <QuestionOption
            marker="3"
            label="Write my own"
            description="Tell your coach what fits."
            onClick={() => setEditing(true)}
          />
        </QuestionOptions>
      )}
    </QuestionCard>
  );
}
