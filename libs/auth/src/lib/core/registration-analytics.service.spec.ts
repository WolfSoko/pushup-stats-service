import { TestBed } from '@angular/core/testing';
import { Analytics, logEvent } from '@angular/fire/analytics';
import {
  RegistrationAnalyticsService,
  REGISTRATION_STEPS,
} from './registration-analytics.service';

jest.mock('@angular/fire/analytics', () => {
  const actual = jest.requireActual('@angular/fire/analytics');
  return {
    ...actual,
    logEvent: jest.fn(),
  };
});

const ANALYTICS_CONSENT_KEY = 'pus_analytics_consent';

describe('RegistrationAnalyticsService', () => {
  const analyticsToken = { __type: 'analytics' } as unknown as Analytics;

  function setupWithAnalytics(): RegistrationAnalyticsService {
    TestBed.configureTestingModule({
      providers: [
        RegistrationAnalyticsService,
        { provide: Analytics, useValue: analyticsToken },
      ],
    });
    return TestBed.inject(RegistrationAnalyticsService);
  }

  function setupWithoutAnalytics(): RegistrationAnalyticsService {
    TestBed.configureTestingModule({
      providers: [RegistrationAnalyticsService],
    });
    return TestBed.inject(RegistrationAnalyticsService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('Given no consent When tracking an event Then logEvent is not called', () => {
    const service = setupWithAnalytics();

    service.trackStarted({ plan_preselected: false });

    expect(logEvent).not.toHaveBeenCalled();
  });

  it('Given consent denied When tracking an event Then logEvent is not called', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'denied');
    const service = setupWithAnalytics();

    service.trackStarted({ plan_preselected: false });

    expect(logEvent).not.toHaveBeenCalled();
  });

  it('Given consent granted but no Analytics provider Then logEvent is not called', () => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
    const service = setupWithoutAnalytics();

    service.trackStarted({ plan_preselected: false });

    expect(logEvent).not.toHaveBeenCalled();
  });

  describe('with consent granted and analytics provider', () => {
    let service: RegistrationAnalyticsService;

    beforeEach(() => {
      localStorage.setItem(ANALYTICS_CONSENT_KEY, 'granted');
      service = setupWithAnalytics();
    });

    it('trackStarted sends register_started with plan_preselected flag', () => {
      service.trackStarted({ plan_preselected: true });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_started',
        {
          plan_preselected: true,
        }
      );
    });

    it('trackStepView sends step name and index', () => {
      service.trackStepView('username', { is_google: false });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_step_view',
        {
          step_name: 'username',
          step_index: REGISTRATION_STEPS.indexOf('username'),
          is_google: false,
        }
      );
    });

    it('trackStepCompleted sends step name and index', () => {
      service.trackStepCompleted('email', { is_google: true });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_step_completed',
        {
          step_name: 'email',
          step_index: 0,
          is_google: true,
        }
      );
    });

    it('trackSubmitted sends register_submitted with is_google', () => {
      service.trackSubmitted({ is_google: true });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_submitted',
        { is_google: true }
      );
    });

    it('trackSucceeded sends register_succeeded', () => {
      service.trackSucceeded({ is_google: false });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_succeeded',
        { is_google: false }
      );
    });

    it('trackFailed sends register_failed with reason', () => {
      service.trackFailed({ is_google: false, reason: 'sign_up' });

      expect(logEvent).toHaveBeenCalledWith(analyticsToken, 'register_failed', {
        is_google: false,
        reason: 'sign_up',
      });
    });

    it('trackAbandoned includes last_step and its index', () => {
      service.trackAbandoned({ last_step: 'daily_goal', is_google: true });

      expect(logEvent).toHaveBeenCalledWith(
        analyticsToken,
        'register_abandoned',
        {
          last_step: 'daily_goal',
          last_step_index: REGISTRATION_STEPS.indexOf('daily_goal'),
          is_google: true,
        }
      );
    });
  });
});
