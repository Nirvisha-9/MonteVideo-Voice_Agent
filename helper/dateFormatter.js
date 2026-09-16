export default function dateFormatter(date) {
  let dateObject;

  if (date?.toDate) {
    // Firestore Timestamp
    dateObject = date.toDate();
  } else if (date?.seconds !== undefined && date?.nanoseconds !== undefined) {
    // Plain object with seconds/nanos
    dateObject = new Date(date.seconds * 1000 + date.nanoseconds / 1e6);
  } else {
    // Normal JS date or string
    dateObject = new Date(date);
  }

  if (isNaN(dateObject)) return '';

  return dateObject.toLocaleDateString('es-UY', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
