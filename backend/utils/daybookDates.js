export const businessDate = (at = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(at);
    const value = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${value.year}-${value.month}-${value.day}`;
};

export const closureStatusFor = (closingDate, today = businessDate()) => {
    if (closingDate > today) throw new Error("Future daybooks cannot be closed.");
    return closingDate === today ? "closed" : "pending_approval";
};

export const previousDaybookDate = (date) => {
    const previous = new Date(`${date}T00:00:00.000Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    return previous.toISOString().slice(0, 10);
};
