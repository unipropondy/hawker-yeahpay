// backend/utils/timezone.js
const moment = require('moment-timezone');

// Singapore timezone (UTC+8)
const SINGAPORE_TZ = 'Asia/Singapore';

// Convert UTC to Singapore time
const toSingaporeTime = (utcDate) => {
    if (!utcDate) return null;
    return moment(utcDate).tz(SINGAPORE_TZ);
};

// Format for API response
const formatSingaporeTime = (utcDate, format = 'YYYY-MM-DD HH:mm:ss') => {
    if (!utcDate) return null;
    return moment(utcDate).tz(SINGAPORE_TZ).format(format);
};

// Get current Singapore time
const getCurrentSingaporeTime = () => {
    return moment().tz(SINGAPORE_TZ);
};

// Get Singapore date only (for date comparisons)
const getSingaporeDate = (utcDate) => {
    if (!utcDate) return null;
    return moment(utcDate).tz(SINGAPORE_TZ).format('YYYY-MM-DD');
};

// Convert Singapore date to UTC range (for database queries)
const getUTCRangeForSingaporeDate = (singaporeDate) => {
    // singaporeDate format: 'YYYY-MM-DD'
    const startOfDay = moment.tz(singaporeDate, SINGAPORE_TZ).startOf('day').utc();
    const endOfDay = moment.tz(singaporeDate, SINGAPORE_TZ).endOf('day').utc();
    
    return {
        start: startOfDay.toDate(),
        end: endOfDay.toDate()
    };
};

module.exports = {
    toSingaporeTime,
    formatSingaporeTime,
    getCurrentSingaporeTime,
    getSingaporeDate,
    getUTCRangeForSingaporeDate,
    SINGAPORE_TZ
};