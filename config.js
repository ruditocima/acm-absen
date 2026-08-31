const CONFIG = {
    SUPABASE: {
        URL: 'https://gviqfdbuoruqldsbbrxk.supabase.co',
        ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2aXFmZGJ1b3J1cWxkc2JicnhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MjU1MzksImV4cCI6MjEwMjIwMTUzOX0.RalUZTRpAKswYK0SxdJjZWkY1wQb1V0JFKmXu8i0Lo0'
    },
    EMAILJS: {
        PUBLIC_KEY: 'il5LfNiQu0y8dsN35',
        SERVICE_ID: 'service_3w0ocfc',
        TEMPLATE_ID: 'template_09rz7kd'
    },
    STORAGE: {
        BUCKET: 'attendance-photos',
        FOLDER: 'selfies'
    },
    ATTENDANCE: {
        OPEN_TIME: '07:45:00',
        MAX_TIME: '09:30:00',
        WORK_DAYS_PER_MONTH: 26
    },
    GPS: {
        DEFAULT_RADIUS: 1500,
        MAX_ACCURACY: 100
    },
    PAGINATION: {
        REKAP_PER_PAGE: 50
    },
    OTP: {
        EXPIRY_MINUTES: 3
    }
};

window.supabaseClient = supabase.createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.ANON_KEY);
