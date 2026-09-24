import { render, screen } from '@testing-library/angular';

import { ReminderFormStore } from './reminder-form.store';
import { ReminderSettingsSectionComponent } from './reminder-settings-section.component';

describe('ReminderSettingsSectionComponent', () => {
  async function setup() {
    const { fixture } = await render(ReminderSettingsSectionComponent, {
      inputs: { permissionStatus: 'granted' },
      providers: [ReminderFormStore],
    });
    const form = fixture.debugElement.injector.get(ReminderFormStore);
    return { fixture, form };
  }

  it('should offer saving only once something changed', async () => {
    // given
    const { fixture, form } = await setup();
    const button = screen.getByTestId('reminder-save') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    // when
    form.setEnabled(true);
    fixture.detectChanges();

    // then
    expect(button.disabled).toBe(false);
  });

  it('should show the save button busy, not disabled, while the settings are written', async () => {
    // given
    const { fixture, form } = await setup();
    form.setEnabled(true);

    // when
    form.setSaving(true);
    fixture.detectChanges();

    // then
    const button = screen.getByTestId('reminder-save') as HTMLButtonElement;
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.disabled).toBe(false);

    // when
    form.markSaved();
    fixture.detectChanges();

    // then
    expect(button.getAttribute('aria-busy')).toBeNull();
  });
});
