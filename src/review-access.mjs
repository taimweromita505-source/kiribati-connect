// Dedicated Play review access is tied to a server-configured immutable account ID.
// It never grants admin access or creates payment records. Set PLAY_REVIEW_ACCESS_ENABLED=false to revoke; retain the account ID for content isolation.
export const reviewer=(env,user)=>env.PLAY_REVIEW_ACCESS_ENABLED==='true'&&!!user&&user.role==='member'&&!!env.PLAY_REVIEWER_USER_ID&&user.userId===env.PLAY_REVIEWER_USER_ID;
export const reviewHidden=(env,user,author)=>!!env.PLAY_REVIEWER_USER_ID&&author===env.PLAY_REVIEWER_USER_ID&&user?.userId!==env.PLAY_REVIEWER_USER_ID&&user?.role!=='admin';
