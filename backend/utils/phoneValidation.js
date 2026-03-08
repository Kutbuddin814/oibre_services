/**
 * Phone validation utility for Indian phone numbers
 * Validates format: +91XXXXXXXXXX or 10-digit number starting with 6-9
 */

/**
 * Validates and normalizes Indian phone number
 * Accepts: +91XXXXXXXXXX, 91XXXXXXXXXX, or XXXXXXXXXX
 * Returns: 10-digit phone number or null if invalid
 */
const validateAndNormalizePhone = (phone) => {
  if (!phone) return null;
  
  let cleanPhone = String(phone).trim();
  
  // Remove +91 prefix if present
  if (cleanPhone.startsWith("+91")) {
    cleanPhone = cleanPhone.substring(3);
  }
  // Remove 91 prefix if present (without +)
  else if (cleanPhone.startsWith("91") && cleanPhone.length === 12) {
    cleanPhone = cleanPhone.substring(2);
  }
  
  // Check if it's exactly 10 digits
  if (!/^\d{10}$/.test(cleanPhone)) {
    return null;
  }
  
  // Check if it starts with 6-9 (valid Indian mobile)
  const firstDigit = cleanPhone.charAt(0);
  if (!/^[6-9]$/.test(firstDigit)) {
    return null;
  }
  
  return cleanPhone;
};

/**
 * Formats phone number with +91 prefix
 * Input: 10-digit number
 * Output: +91XXXXXXXXXX
 */
const formatPhoneWithPrefix = (phone) => {
  const cleanPhone = validateAndNormalizePhone(phone);
  if (!cleanPhone) return null;
  return `+91${cleanPhone}`;
};

/**
 * Get error message for invalid phone
 */
const getPhoneErrorMessage = () => {
  return "Please enter a valid 10-digit Indian mobile number (+91XXXXXXXXXX or XXXXXXXXXX, starting with 6-9)";
};

module.exports = {
  validateAndNormalizePhone,
  formatPhoneWithPrefix,
  getPhoneErrorMessage
};
