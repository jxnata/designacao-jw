import { openUrl } from "@tauri-apps/plugin-opener";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getConfig, importarSemanas } from "../lib/db";
import { ErroValidacaoApostila, importarApostilaPdf } from "../lib/mwb";

const URL_APOSTILA_PT = "https://www.jw.org/pt/biblioteca/jw-apostila-do-mes/";
const URL_APOSTILA_LIBRAS = "https://www.jw.org/bzs/biblioteca/jw-apostila-do-mes/";

type Resultado = { importadas: number; ignoradas: number; aviso: string | null };

export default function ImportarSemanas() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [congregacaoSinais, setCongregacaoSinais] = useState<boolean | null>(null);

  useEffect(() => {
    getConfig().then((c) => setCongregacaoSinais(c.congregacao_sinais));
  }, []);

  const urlApostila = congregacaoSinais ? URL_APOSTILA_LIBRAS : URL_APOSTILA_PT;

  async function processarArquivo(arquivo: File) {
    setErro(null);
    setResultado(null);
    if (!arquivo.name.toLowerCase().endsWith(".pdf") && arquivo.type !== "application/pdf") {
      setErro("Selecione o arquivo PDF da apostila baixado do jw.org.");
      return;
    }
    setProcessando(true);
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const { semanas, aviso } = await importarApostilaPdf(bytes, congregacaoSinais ?? false);
      const { importadas, ignoradas } = await importarSemanas(semanas);
      setResultado({ importadas, ignoradas, aviso });
    } catch (e) {
      setErro(e instanceof ErroValidacaoApostila ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  }

  function aoSoltarArquivo(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    const arquivo = e.dataTransfer.files[0];
    if (arquivo) processarArquivo(arquivo);
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          onClick={() => navigate("/designacao")}
        >
          <ArrowLeft className="size-4" />
          Voltar
        </button>
        <h1 className="text-lg font-semibold">Adicionar Semanas</h1>
      </div>

      <div className="mb-4 rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <p className="mb-2">
          Baixe o PDF da apostila da reunião (
          <em>Nossa Vida e Ministério Cristão</em>) direto do jw.org e importe o arquivo aqui — o app lê o
          conteúdo do PDF, sem precisar buscar nada pela internet.
        </p>
        <button
          className="font-medium text-teal-700 underline hover:text-teal-800"
          onClick={() => openUrl(urlApostila)}
        >
          {urlApostila}
        </button>
        {congregacaoSinais != null && (
          <p className="mt-2 text-xs text-slate-400">
            {congregacaoSinais
              ? "Link da edição em Libras, de acordo com a configuração da congregação."
              : "Link da edição em português, de acordo com a configuração da congregação."}
          </p>
        )}
      </div>

      <div
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          arrastando ? "border-teal-500 bg-teal-50" : "border-slate-300 bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltarArquivo}
      >
        {processando ? (
          <>
            <Loader2 className="size-8 animate-spin text-teal-700" />
            <p className="text-sm text-slate-600">Lendo e importando o PDF…</p>
          </>
        ) : (
          <>
            <FileUp className="size-8 text-slate-400" />
            <p className="text-sm text-slate-600">Arraste o PDF da apostila aqui</p>
            <p className="text-xs text-slate-400">ou</p>
            <button
              className="inline-flex items-center gap-1.5 rounded bg-teal-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
              onClick={() => inputRef.current?.click()}
            >
              Selecionar arquivo
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                e.target.value = "";
                if (arquivo) processarArquivo(arquivo);
              }}
            />
          </>
        )}
      </div>

      {erro && (
        <p className="mt-4 flex items-start gap-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {erro}
        </p>
      )}

      {resultado && (
        <div className="mt-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <p className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            {resultado.importadas === 0
              ? "Nenhuma semana nova — todas as semanas deste PDF já estavam importadas."
              : `${resultado.importadas} ${resultado.importadas === 1 ? "semana importada" : "semanas importadas"}` +
                (resultado.ignoradas > 0 ? ` (${resultado.ignoradas} já existiam).` : ".")}
          </p>
          {resultado.aviso && (
            <p className="mt-2 flex items-start gap-2 text-amber-700">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {resultado.aviso}
            </p>
          )}
          <button
            className="mt-3 inline-flex items-center gap-1.5 rounded bg-teal-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-800"
            onClick={() => navigate("/designacao")}
          >
            Ver semanas
          </button>
        </div>
      )}
    </div>
  );
}
