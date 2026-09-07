import { useState } from "react";
import {
  ArtifactCard,
  EvidenceList,
  Disclosure,
  NoticeRow,
  ChatTurn,
  MessageContent,
  ReplyActions,
  ComposerControls,
  ComposerInput,
  ComposerAction,
  AttachmentList,
  AttachmentPreview,
  QueuedMessageList,
  QueuedMessageRow,
  Button,
} from "@enduragent/ui";
import { SampleQuestion } from "./sample-question";

export function ChatExperiment() {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [responding, setResponding] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [attachment, setAttachment] = useState(true);
  const [queue, setQueue] = useState<string[]>([]);
  const [reply, setReply] = useState(
    "Your recorded ride totals 1h 20m for 31 August–6 September 1998.",
  );
  function send() {
    if (!draft.trim()) return;
    if (responding) setQueue([...queue, draft.trim()]);
    else {
      setMessages([...messages, draft.trim()]);
      setResponding(true);
      setStopped(false);
    }
    setDraft("");
  }
  return (
    <>
      <ChatTurn speaker="coach" label="Coach">
        <MessageContent>{reply}</MessageContent>
        <ReplyActions>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setReply("The fictional week contains one recorded ride, totalling 1h 20m.")
            }
          >
            Try again
          </Button>
        </ReplyActions>
      </ChatTurn>
      <ArtifactCard
        eyebrow="Training"
        title="Your recorded week"
        summary="31 August–6 September 1998"
      >
        <div className="px-4 pb-4">
          <EvidenceList
            label="Weekly facts"
            rows={[
              { id: "riding", label: "Riding time", source: "Fictional rides", value: "1h 20m" },
              { id: "load", label: "Load", source: "Fictional rides", value: "56" },
            ]}
          />
          <Disclosure summary="Data reviewed">
            One fictional ride from this week. No live training data is connected.
          </Disclosure>
        </div>
      </ArtifactCard>
      {messages.map((message, index) => (
        <ChatTurn key={index} speaker="athlete" label="Athlete">
          <MessageContent>{message}</MessageContent>
        </ChatTurn>
      ))}
      {responding ? (
        <NoticeRow title="Sample response paused">
          Use Stop responding to finish this simulated response.
        </NoticeRow>
      ) : stopped ? (
        <NoticeRow role="status" title="Response stopped">
          Your message remains in this experiment.
        </NoticeRow>
      ) : null}
      <SampleQuestion />
      {queue.length ? (
        <QueuedMessageList
          title="Queued messages"
          count={queue.length}
          announcement={`${queue.length} queued messages`}
        >
          {queue.map((message, index) => (
            <QueuedMessageRow
              key={index}
              actions={
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft(message);
                      setQueue(queue.filter((_, i) => i !== index));
                    }}
                  >
                    Edit queued message
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQueue(queue.filter((_, i) => i !== index))}
                  >
                    Remove queued message
                  </Button>
                </>
              }
            >
              {message}
            </QueuedMessageRow>
          ))}
        </QueuedMessageList>
      ) : null}
      {attachment ? (
        <AttachmentList>
          <AttachmentPreview
            title="sample-ride.txt"
            detail="Fictional attachment · 1998"
            actions={
              <Button variant="ghost" size="sm" onClick={() => setAttachment(false)}>
                Remove attachment
              </Button>
            }
          />
        </AttachmentList>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <ComposerControls
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setAttachment(true)}>
                Add sample attachment
              </Button>
              {responding ? (
                <div className="flex gap-2">
                  <Button type="submit" variant="ghost" disabled={!draft.trim()}>
                    Queue message
                  </Button>
                  <ComposerAction
                    mode="stop"
                    onClick={() => {
                      setResponding(false);
                      setStopped(true);
                    }}
                  />
                </div>
              ) : (
                <ComposerAction mode="send" disabled={!draft.trim()} />
              )}
            </>
          }
        >
          <ComposerInput
            aria-label="Message your coach"
            placeholder="Message your coach"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </ComposerControls>
      </form>
    </>
  );
}
