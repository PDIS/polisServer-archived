const config = {
  DEV_MODE: false,
  LOCAL_SERVER: true,
  PORT: 5000,
  MATH_ENV: 'prod',
  STATIC_FILES_ORIGIN: 'http://localhost:5044', // Static file origin relative to the server
  SERVICE_URL: 'https://your.domain.com', // IMPORTANT: DO NOT add tailing slash!
  DATABASE_URL: 'postgres://polis:polis@localhost:5432/polis',
  DATABASE_FOR_READS_NAME: 'DATABASE_URL',
  POLIS_FROM_ADDRESS: 'polis-noreply <polis-noreply@domainOverride>',
  DISABLE_INTERCOM: true,
  ADMIN_UIDS: [],
  ADMIN_EMAILS: [],
  ADMIN_EMAIL_DATA_EXPORT: [],
  ADMIN_EMAIL_DATA_EXPORT_TEST: [],
  ADMIN_EMAIL_EMAIL_TEST: [],
  DISABLE_SPAM_CHECK: false,
  SHOULD_USE_TRANSLATION_API: true,
  GOOGLE_APPLICATION_CREDENTIALS: 'translate-creds.json',
  JOIN_SERVER: 'https://join.gov.tw',
  STOP_REGISTER: true,
  TWITTER_CONSUMER_KEY: '',
  TWITTER_CONSUMER_SECRET: '',
  MAILGUN_API_KEY: '',
  MAILGUN_DOMAIN: '',
  JOIN_API_KEY: ''
};

for (let key in config) {
  if (config[key]) {
    process.env[key] = config[key].toString();
  }
}

module.exports = config;