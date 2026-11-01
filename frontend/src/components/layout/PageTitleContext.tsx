import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface PageTitleValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const PageTitleContext = createContext<PageTitleValue>({ title: null, setTitle: () => {} });

/**
 * Lets a detail page publish the record's real name to the shell, so the
 * breadcrumb reads "Fields / North 80" rather than "Fields / Field".
 */
export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ title, setTitle }), [title]);
  return <PageTitleContext.Provider value={value}>{children}</PageTitleContext.Provider>;
}

export function usePageTitle() {
  return useContext(PageTitleContext);
}

/** Publish a page title for the breadcrumb and document title. */
export function useRegisterPageTitle(title: string | null | undefined) {
  const { setTitle } = usePageTitle();
  useEffect(() => {
    setTitle(title ?? null);
    if (title) document.title = `${title} · AgriNexa`;
    return () => setTitle(null);
  }, [title, setTitle]);
}
