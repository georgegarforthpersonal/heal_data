import ButterflySurveyForm from "@/components/butterfly-survey-form"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🦋 Butterfly Survey App</h1>
          <p className="text-lg text-gray-600">Professional butterfly survey data collection and management</p>
        </header>
        
        <ButterflySurveyForm />
      </div>
    </div>
  );
}
