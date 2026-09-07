import { useRef, useState } from "react";
import {
  ArtifactCard,
  BeforeAfterList,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Disclosure,
  EvidenceList,
  NoticeRow,
  WorkoutList,
} from "@enduragent/ui";
import { SampleQuestion } from "./sample-question";

type Stage =
  | "paused"
  | "question"
  | "draft"
  | "stale"
  | "confirm"
  | "active"
  | "change"
  | "history";
export function PlanExperiment() {
  const [stage, setStage] = useState<Stage>("paused");
  const [changed, setChanged] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [draftAnswer, setDraftAnswer] = useState<string | null>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const activate = useRef<HTMLButtonElement>(null);
  function discard() {
    setAnswer(null);
    setDraftAnswer(null);
    setChanged(false);
    setStage("paused");
  }
  function reviewDraft() {
    if (answer === null) return;
    if (draftAnswer === null) {
      setDraftAnswer(answer);
      setStage("draft");
    } else setStage(answer === draftAnswer ? "draft" : "stale");
  }
  function rebuildDraft() {
    if (answer === null) return;
    setDraftAnswer(answer);
    setStage("draft");
  }
  return (
    <>
      {stage === "paused" ? (
        <ArtifactCard
          eyebrow="Plan creation"
          title="Continue creating your Plan"
          summary="A fictional Plan creation session, paused at weekly time."
          actions={<Button onClick={() => setStage("question")}>Resume</Button>}
        />
      ) : null}
      {stage === "question" ? (
        <>
          <SampleQuestion onAnswer={setAnswer} />
          <Button className="justify-self-start" disabled={answer === null} onClick={reviewDraft}>
            Review sample Draft
          </Button>
        </>
      ) : null}
      {stage === "draft" || stage === "stale" || stage === "confirm" ? (
        <ArtifactCard
          eyebrow="Draft"
          title="Build consistency"
          status={stage === "stale" ? "Stale" : "Needs review"}
          summary="7 September–1 November 1998 · Eight weeks"
          actions={
            <>
              <Button variant="ghost" onClick={discard}>
                Discard
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setAnswer(null);
                  setStage("question");
                }}
              >
                Edit answers
              </Button>
              {stage === "stale" ? (
                <Button onClick={rebuildDraft}>Rebuild sample Draft</Button>
              ) : (
                <Button ref={activate} onClick={() => setStage("confirm")}>
                  Activate Plan
                </Button>
              )}
            </>
          }
        >
          {stage === "stale" ? (
            <NoticeRow tone="warning" title="Answers changed">
              Rebuild the Draft before activating it. These Workouts use your earlier answers.
            </NoticeRow>
          ) : null}
          <WorkoutList
            label="Week 1 Workouts"
            rows={[
              {
                id: "easy",
                when: "Mon 7 Sep 1998",
                title: "Easy ride",
                detail: "45 min",
                status: "Planned",
              },
              {
                id: "steady",
                when: "Thu 10 Sep 1998",
                title: "Steady ride",
                detail: "60 min",
                status: "Planned",
              },
            ]}
          />
          <div className="p-4">
            <Disclosure summary="How this Plan was built">
              <EvidenceList
                label="Draft inputs"
                rows={[
                  {
                    id: "time",
                    label: "Weekly time",
                    source: "Your sample answer",
                    value: draftAnswer,
                  },
                  {
                    id: "basis",
                    label: "Training history",
                    source: "Fictional data",
                    value: "Six weeks",
                  },
                ]}
              />
            </Disclosure>
          </div>
        </ArtifactCard>
      ) : null}
      <Dialog
        open={stage === "confirm"}
        onOpenChange={(open) => {
          if (!open) setStage("draft");
        }}
      >
        <DialogContent showCloseButton={false} initialFocus={cancel} finalFocus={activate}>
          <DialogHeader>
            <DialogTitle>Activate this sample Plan?</DialogTitle>
            <DialogDescription>
              Only the display in this experiment changes. Your training calendar is not connected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button ref={cancel} variant="ghost" onClick={() => setStage("draft")}>
              Cancel
            </Button>
            <Button onClick={() => setStage("active")}>Activate sample Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {stage === "active" ? (
        <>
          <NoticeRow role="status" title="Sample Plan activated">
            This state lasts until Reset or reload.
          </NoticeRow>
          <ArtifactCard
            eyebrow="Plan library"
            title="Build consistency"
            status="Active"
            summary="7 September–1 November 1998"
            actions={
              <>
                <Button variant="ghost" onClick={() => setStage("history")}>
                  View history
                </Button>
                {changed ? null : (
                  <Button onClick={() => setStage("change")}>Review sample change</Button>
                )}
              </>
            }
          >
            <WorkoutList
              label="Active Plan Workouts"
              rows={[
                {
                  id: "active-steady",
                  when: "Thu 10 Sep 1998",
                  title: "Steady ride",
                  detail: changed ? "45 min" : "60 min",
                  status: "Planned",
                },
              ]}
            />
          </ArtifactCard>
        </>
      ) : null}
      {stage === "change" ? (
        <ArtifactCard
          eyebrow="Plan change"
          title="Shorten Thursday’s ride"
          summary="A fictional change for your review."
          actions={
            <>
              <Button variant="ghost" onClick={() => setStage("active")}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setChanged(true);
                  setStage("history");
                }}
              >
                Apply sample change
              </Button>
            </>
          }
        >
          <div className="px-4 pb-4">
            <BeforeAfterList
              label="Workout changes"
              rows={[
                {
                  id: "thursday",
                  label: "Thu 10 Sep 1998",
                  before: "Steady ride · 60 min",
                  after: "Steady ride · 45 min",
                },
              ]}
            />
            <Disclosure summary="Why this changed">
              This sample uses a fictional request for a shorter ride.
            </Disclosure>
          </div>
        </ArtifactCard>
      ) : null}
      {stage === "history" ? (
        <ArtifactCard
          eyebrow="Plan history"
          title="Sample change history"
          summary="Fictional history · 8 September 1998"
          actions={
            <Button variant="ghost" onClick={() => setStage("active")}>
              Back to Plan
            </Button>
          }
        >
          <div className="px-4 pb-4">
            <EvidenceList
              label="Change history"
              rows={
                changed
                  ? [
                      {
                        id: "shorter",
                        label: "Thursday ride",
                        source: "Sample request",
                        value: "60 min → 45 min",
                      },
                    ]
                  : [{ id: "none", label: "Changes", value: "No changes yet" }]
              }
            />
          </div>
        </ArtifactCard>
      ) : null}
    </>
  );
}
