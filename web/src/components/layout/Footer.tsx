import { useLocale } from '../../i18n';

export default function Footer() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-gray-200 py-6 text-center text-xs text-gray-400">
      <p>
        {t.footer.line}{' '}
        <a
          href="https://github.com/yuanmu97/citation-impact"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-gray-600"
        >
          GitHub
        </a>
      </p>
    </footer>
  );
}
