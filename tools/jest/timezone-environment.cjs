const { TestEnvironment } = require('jest-environment-node');

/**
 * A Node test environment pinned to one timezone.
 *
 * `process.env.TZ` assigned from inside a test never reaches the real
 * process — Jest hands the test file its own copy of `process` — so V8
 * keeps the runner's timezone and a date bug that only exists away from
 * UTC cannot be reproduced. Setting it out here resets the timezone for
 * the whole worker; the previous value is restored on teardown so the
 * next file to land in that worker is unaffected.
 *
 * Usage, per spec file:
 *
 *     /**
 *      * @jest-environment <relative path>/tools/jest/timezone-environment.cjs
 *      * @jest-environment-options {"timezone": "America/New_York"}
 *      *\/
 */
class TimezoneEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    this.timezone = config.projectConfig.testEnvironmentOptions?.timezone;
    this.previousTimezone = undefined;
  }

  async setup() {
    if (this.timezone) {
      this.previousTimezone = process.env.TZ;
      process.env.TZ = this.timezone;
    }
    await super.setup();
  }

  async teardown() {
    await super.teardown();
    if (!this.timezone) return;
    if (this.previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = this.previousTimezone;
  }
}

module.exports = TimezoneEnvironment;
