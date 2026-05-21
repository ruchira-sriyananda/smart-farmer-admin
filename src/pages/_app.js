import { useEffect } from 'react'
import 'bootstrap/dist/css/bootstrap.min.css'

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Dynamically import bootstrap JS only on client side
    import('bootstrap/dist/js/bootstrap.bundle.min.js')
  }, [])

  return <Component {...pageProps} />
}