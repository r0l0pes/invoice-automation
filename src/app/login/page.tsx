
import LoginForm from './login-form'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="bg-white rounded-2xl shadow-md p-6">
                    <h1 className="text-xl font-semibold text-slate-900 text-center mb-6">Sign in</h1>
                    <LoginForm />
                </div>
            </div>
        </div>
    )
}
