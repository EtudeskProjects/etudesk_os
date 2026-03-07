export interface NotificationRouteData {
  type?: string;
  screen?: string;
  applicationId?: string;
  membershipId?: string;
  bookingId?: string;
  opportunityId?: string;
  spaceId?: string;
  communityId?: string;
}

export function getNotificationRoute(data: NotificationRouteData): string | null {
  const type = data.type;
  const screen = data.screen;

  if (type === 'MESSAGE' || screen?.includes('messages')) {
    if (data.applicationId) return `/settings/my-applications/${data.applicationId}?tab=messages`;
    if (data.membershipId) return `/settings/my-communities/${data.membershipId}?tab=messages`;
    if (data.bookingId) return `/settings/my-reservations/${data.bookingId}?tab=messages`;
    return null;
  }

  if (type === 'APPLICATION' && data.applicationId) {
    return `/settings/my-applications/${data.applicationId}`;
  }
  if (type === 'MEMBERSHIP' && data.membershipId) {
    return `/settings/my-communities/${data.membershipId}`;
  }
  if (type === 'BOOKING' && data.bookingId) {
    return `/settings/my-reservations/${data.bookingId}`;
  }
  if ((type === 'BOOKING_REMINDER') && data.bookingId) {
    return `/settings/my-reservations/${data.bookingId}`;
  }
  if ((type === 'APPLICATION_REMINDER') && data.applicationId) {
    return `/settings/my-applications/${data.applicationId}`;
  }
  if ((type === 'OPPORTUNITY' || type === 'OPPORTUNITY_REMINDER') && data.opportunityId) {
    return `/details/opportunity/${data.opportunityId}`;
  }
  if (type === 'SPACE' && data.spaceId) {
    return `/details/space/${data.spaceId}`;
  }
  if (
    (
      type === 'EVENT_REMINDER' ||
      type === 'EVENT_REMINDER_1D' ||
      type === 'EVENT_REMINDER_1H' ||
      type === 'NEW_ACTIVITY' ||
      type === 'MENTION' ||
      type === 'COMMENT_REPLY' ||
      type === 'MEMBERSHIP_APPROVED' ||
      type === 'MEMBERSHIP_REJECTED'
    ) &&
    data.communityId
  ) {
    return `/details/community/${data.communityId}`;
  }

  return null;
}
