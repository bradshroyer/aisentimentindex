import annotationsData from "@/data/spike_annotations.json";
import { bucketKey, type Granularity } from "./bucketing";

export interface SpikeAnnotation {
  date: string;
  label: string;
  direction: "up" | "down";
  blurb: string;
}

export const SPIKE_ANNOTATIONS: SpikeAnnotation[] = (
  annotationsData.events as SpikeAnnotation[]
);

export function annotationsByBucket(
  g: Granularity,
  annotations: SpikeAnnotation[] = SPIKE_ANNOTATIONS,
): Map<string, SpikeAnnotation[]> {
  const out = new Map<string, SpikeAnnotation[]>();
  for (const a of annotations) {
    const key = bucketKey(a.date, g);
    const arr = out.get(key);
    if (arr) arr.push(a);
    else out.set(key, [a]);
  }
  return out;
}
