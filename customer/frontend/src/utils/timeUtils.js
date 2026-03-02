/**
 * Converts 24-hour time string (HH:MM) to 12-hour format with AM/PM
 * @param {string} time24 - Time in 24-hour format (e.g., "16:45", "08:00", "00:00")
 * @returns {string} Time in 12-hour format (e.g., "4:45 PM", "8:00 AM", "12:00 AM")
 */
export const convertTo12HourFormat = (time24) => {
  if (!time24 || typeof time24 !== "string") return time24;

  // Check if it's already in 12-hour format (contains AM/PM)
  if (/AM|PM/i.test(time24)) {
    return time24;
  }

  // Parse the time
  const parts = time24.split(":");
  if (parts.length < 2) return time24;

  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];

  if (isNaN(hours)) return time24;

  // Determine AM/PM
  const meridiem = hours >= 12 ? "PM" : "AM";

  // Convert hours to 12-hour format
  hours = hours % 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${meridiem}`;
};

/**
 * Formats date and time together in user-friendly format
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} time24 - Time in 24-hour format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date, time24) => {
  if (!date) return "";
  const formattedTime = convertTo12HourFormat(time24);
  return `${date} at ${formattedTime}`;
};
