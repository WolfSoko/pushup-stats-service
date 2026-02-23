import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { signal } from '@angular/core';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: Partial<AuthService>;
  let router: Partial<Router>;

  beforeEach(async () => {
    // Mock AuthService with all required methods and signals
    const mockAuthService = {
      loading: signal(false),
      error: signal<Error | null>(null),
      signInWithGoogle: jest.fn().mockResolvedValue(undefined),
      signInWithEmail: jest.fn().mockResolvedValue(undefined),
      signUpWithEmail: jest.fn().mockResolvedValue(undefined),
    };

    const mockRouter = {
      navigate: jest.fn().mockResolvedValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [
        LoginComponent,
        ReactiveFormsModule,
        NoopAnimationsModule
      ],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        FormBuilder,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    router = TestBed.inject(Router);

    // Initial data binding
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the login form and Google button', () => {
    const emailInput = fixture.nativeElement.querySelector('input[type="email"]');
    const passwordInput = fixture.nativeElement.querySelector('input[type="password"]');
    const loginButton = fixture.nativeElement.querySelector('button[type="submit"]');
    const googleButton = fixture.nativeElement.querySelector('.google-button');

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(loginButton).toBeTruthy();
    expect(googleButton).toBeTruthy();
  });

  it('should call signInWithGoogle when the Google button is clicked', async () => {
    const googleButton = fixture.nativeElement.querySelector('.google-button');
    googleButton.click();

    await fixture.whenStable();

    expect(authService.signInWithGoogle).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should call signInWithEmail on form submit in login mode', async () => {
    component.isRegisterMode.set(false);
    component.loginForm.setValue({ email: 'test@test.com', password: 'password123' });
    fixture.detectChanges();

    const loginButton = fixture.nativeElement.querySelector('button[type="submit"]');
    loginButton.click();

    await fixture.whenStable();

    expect(authService.signInWithEmail).toHaveBeenCalledWith('test@test.com', 'password123');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should call signUpWithEmail on form submit in register mode', async () => {
    component.isRegisterMode.set(true);
    component.loginForm.setValue({ email: 'new@test.com', password: 'newpassword123' });
    fixture.detectChanges();

    const registerButton = fixture.nativeElement.querySelector('button[type="submit"]');
    registerButton.click();

    await fixture.whenStable();

    expect(authService.signUpWithEmail).toHaveBeenCalledWith('new@test.com', 'newpassword123');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('should toggle between login and register mode', () => {
    expect(component.isRegisterMode()).toBe(false);

    const toggleButton = fixture.nativeElement.querySelector('.toggle-mode button');
    toggleButton.click();
    fixture.detectChanges();

    expect(component.isRegisterMode()).toBe(true);
    let buttonText = fixture.nativeElement.querySelector('.toggle-mode button').textContent.trim();
    expect(buttonText).toBe('Zum Login');

    toggleButton.click();
    fixture.detectChanges();

    expect(component.isRegisterMode()).toBe(false);
    buttonText = fixture.nativeElement.querySelector('.toggle-mode button').textContent.trim();
    expect(buttonText).toBe('Registrieren');
  });

  it('should disable the submit button if the form is invalid', () => {
    component.loginForm.setValue({ email: 'invalid-email', password: '' });
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submitButton.disabled).toBe(true);
  });
});
