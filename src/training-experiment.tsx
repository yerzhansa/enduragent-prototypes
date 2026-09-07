import { useState } from "react";
import {
  Button,
  WeeklySummary,
  CompactTrend,
  SectionHeading,
  SelectableRideRow,
  RideMetricList,
  FactualCallout,
  Disclosure,
  NoticeRow,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@enduragent/ui";

export function TrainingExperiment() {
  const [period, setPeriod] = useState("current");
  const [sample, setSample] = useState("complete");
  const [ride, setRide] = useState(false);
  const periods = [
    { value: "current", label: "31 August–6 September 1998" },
    { value: "previous", label: "24–30 August 1998" },
  ];
  const samples = [
    { value: "complete", label: "Complete sample" },
    { value: "missing", label: "Missing power" },
    { value: "empty", label: "No rides" },
  ];
  if (ride)
    return (
      <>
        <Button variant="ghost" className="justify-self-start" onClick={() => setRide(false)}>
          Back to Training
        </Button>
        <SectionHeading
          title="Morning ride"
          meta={period === "current" ? "3 September 1998" : "27 August 1998"}
        />
        <RideMetricList
          rows={[
            { id: "time", label: "Moving time", value: "1h 20m" },
            { id: "distance", label: "Distance", value: "32 km" },
            { id: "load", label: "Load", value: "56" },
            { id: "power", label: "Average power", value: sample === "missing" ? "—" : "145 W" },
          ]}
        />
        <FactualCallout title="Longest ride this week">
          1h 20m of recorded moving time.
        </FactualCallout>
        <Disclosure summary="Ride details">
          Fictional recording.{" "}
          {sample === "missing"
            ? "No power samples are available."
            : "Power samples are available for the full ride."}
        </Disclosure>
      </>
    );
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Select
          items={periods}
          value={period}
          onValueChange={(value) => {
            if (value !== null) setPeriod(value);
          }}
        >
          <SelectTrigger aria-label="Week">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={samples}
          value={sample}
          onValueChange={(value) => {
            if (value !== null) setSample(value);
          }}
        >
          <SelectTrigger aria-label="Sample data">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {samples.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <WeeklySummary
        label={period === "current" ? periods[0]?.label : periods[1]?.label}
        ridingTime={sample === "empty" ? "0h" : "1h 20m"}
        rideCount={sample === "empty" ? "0 rides" : "1 ride"}
        distance={sample === "empty" ? "0 km" : "32 km"}
        load={sample === "empty" ? "Load 0" : "Load 56"}
        trend={
          <CompactTrend
            title="Riding time"
            period="Six complete weeks"
            content={
              sample === "empty"
                ? {
                    kind: "unavailable",
                    message: "Trend unavailable",
                    reason: "This sample has no recorded rides.",
                  }
                : {
                    kind: "ready",
                    headings: ["Week", "Rides", "Riding time"],
                    buckets: [2, 3, 2, 4, 3, 4].map((value, index) => ({
                      id: `week-${index}`,
                      label: `W${index + 1}`,
                      range: `Fictional week ${index + 1}`,
                      value,
                      count: "3 rides",
                      formattedValue: `${value}h`,
                    })),
                  }
            }
          />
        }
      />
      <SectionHeading title="Rides" meta={sample === "empty" ? "No rides" : "1 ride"} />
      {sample === "empty" ? (
        <NoticeRow title="No rides recorded">Choose another sample to review a ride.</NoticeRow>
      ) : (
        <ul className="m-0 list-none p-0">
          <SelectableRideRow
            date={
              period === "current"
                ? { iso: "1998-09-03", weekday: "Thu", day: "3" }
                : { iso: "1998-08-27", weekday: "Thu", day: "27" }
            }
            title="Morning ride"
            meta="Outdoor · Fictional recording"
            duration="1h 20m"
            load="Load 56"
            onClick={() => setRide(true)}
          />
        </ul>
      )}
    </>
  );
}
