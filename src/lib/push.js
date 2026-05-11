import webpush from 'web-push';

if (
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY !== 'YOUR_VAPID_PUBLIC_KEY_HERE'
) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'temple@example.com'),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// A subscription is considered "permanently gone" if the push service returns
// any of these — there's no point keeping the row around.
// 404/410 = endpoint deregistered, 403 = VAPID key changed, 401 = bad auth.
const TERMINAL_STATUS = new Set([401, 403, 404, 410]);

export async function sendPushToSubscription(subscription, payload) {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { success: true };
  } catch (err) {
    const status = err.statusCode || 0;
    if (TERMINAL_STATUS.has(status)) return { success: false, expired: true, status };
    return { success: false, error: err.message, status };
  }
}

export async function broadcastPush(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPushToSubscription(sub, payload))
  );
  return results.map((r, i) => ({
    endpoint: subscriptions[i].endpoint,
    ...(r.status === 'fulfilled' ? r.value : { success: false, error: r.reason }),
  }));
}
