import App, { AppContext, AppInitialProps, AppProps } from 'next/app'
import "../app/globals.css";

export default function MyApp({
  Component,
  pageProps,
}: AppProps) {
  return (
    <Component {...pageProps} />
  )
}
 
MyApp.getInitialProps = async (
  context: AppContext
): Promise<AppInitialProps> => {
  const ctx = await App.getInitialProps(context)

  return ctx
}
