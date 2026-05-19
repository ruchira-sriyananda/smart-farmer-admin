export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-green-600 mb-4">Smart Farmer Admin</h1>
        <p className="text-gray-600 mb-8">Welcome to the Admin Panel</p>
        <a 
          href="/admin/login" 
          className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
        >
          Go to Admin Login
        </a>
      </div>
    </div>
  )
}