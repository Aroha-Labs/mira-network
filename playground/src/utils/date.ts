import { format, formatDistanceToNow } from "date-fns";

export function utcToLocal(utcTime: string): Date {
  // try {
  // Append 'Z' to indicate UTC if it's missing
  const utcTimeWithZ = utcTime.trim().replace(" ", "T") + "Z";

  // Parse the UTC time string to a Date object
  const utcDate = new Date(utcTimeWithZ);
  if (isNaN(utcDate.getTime())) {
    throw new Error("Invalid UTC time format");
  }

  // Return the local Date object
  return utcDate;
  // } catch (error) {
  //     console.error("Error converting UTC to local date:", (error as Error).message);
  //     return null;
  // }
}

export function formatDateTime(date: string | Date): string {
  if (typeof date === "string") {
    const localDate = utcToLocal(date);
    return format(localDate, "PPpp");
  }

  return format(date, "PPpp");
}

export function formatRelativeTime(date: string | Date): string {
  if (typeof date === "string") {
    const localDate = utcToLocal(date);
    return formatDistanceToNow(localDate, { addSuffix: true });
  }

  return formatDistanceToNow(date, { addSuffix: true });
}
