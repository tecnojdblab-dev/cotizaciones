import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, message, Modal, Segmented, Space, Typography } from 'antd'
import { FilePdfOutlined, FileWordOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons'
import NotaForm from './components/NotaForm.jsx'
import NotaPreview from './components/NotaPreview.jsx'
import NotasHistory from './components/NotasHistory.jsx'
import { createEmptyNota, duplicateNota, normalizeNota } from './domain/nota.js'
import { useNotas } from './hooks/useNotas.js'
import { downloadNotaPdf } from './utils/downloadNotaPdf.js'
import { downloadNotaWord } from './utils/downloadNotaWord.js'
import './notas.css'

const { Title, Text } = Typography

export default function NotasPage() {
  const { notas, total, loading, error, query, setQuery, saveNota, deleteNota } = useNotas()
  const navigate = useNavigate()
  const [view, setView] = useState('crear')
  const [editing, setEditing] = useState(null)
  const [formValue, setFormValue] = useState(createEmptyNota)
  const [draft, setDraft] = useState(createEmptyNota)
  const [viewing, setViewing] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleChange = useCallback((values) => setDraft(normalizeNota(values)), [])

  const handlePdfDownload = useCallback(async (nota) => {
    if (!nota) return
    setPdfLoading(true)
    const hideMessage = message.loading('Generando PDF...', 0)
    try {
      await downloadNotaPdf(nota)
      message.success('PDF descargado correctamente')
    } catch (error) {
      console.error('[Notas] Error al exportar PDF:', error)
      message.error(error.message || 'No se pudo generar el PDF')
    } finally {
      hideMessage()
      setPdfLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    const empty = createEmptyNota()
    setEditing(null)
    setFormValue(empty)
    setDraft(empty)
  }, [])

  const save = async (values) => {
    try {
      await saveNota(values, editing?.id)
      message.success(values.estado === 'finalizada' ? 'Nota finalizada' : 'Borrador guardado')
      reset()
      setView('historial')
    } catch (error) {
      message.error(error.message || 'No se pudo guardar la nota')
    }
  }

  const edit = (nota) => {
    setEditing(nota)
    setFormValue(nota)
    setDraft(nota)
    setView('crear')
  }

  const duplicate = (nota) => {
    const copy = duplicateNota(nota)
    setEditing(null)
    setFormValue(copy)
    setDraft(copy)
    setView('crear')
  }

  const remove = async (id) => {
    try {
      await deleteNota(id)
      message.success('Nota eliminada')
    } catch (requestError) {
      message.error(requestError.message || 'No se pudo eliminar la nota')
    }
  }

  const createCertificado = (nota) => navigate('/certificados', { state: { notaOrigen: nota } })

  const word = async (nota) => {
    try {
      await downloadNotaWord(nota)
    } catch (error) {
      message.error(error.message || 'No se pudo generar el Word')
    }
  }

  return (
    <div className="notas-page">
      <header className="notas-page__header">
        <div>
          <Title level={3}>Notas</Title>
          <Text type="secondary">Inicio / Documentos / Notas de entrega</Text>
        </div>
        <Segmented
          value={view}
          onChange={(value) => {
            setView(value)
            if (value === 'crear' && !editing) reset()
          }}
          options={[
            { value: 'crear', label: 'Crear nota', icon: <PlusOutlined /> },
            { value: 'historial', label: 'Historial', icon: <HistoryOutlined /> },
          ]}
        />
      </header>

      {error && <Alert showIcon type="error" message="No se pudieron sincronizar las notas" description={error.message} closable />}

      {view === 'crear' ? (
        <div className="notas-create-grid">
          <Card title={editing ? 'Editar nota de entrega' : 'Datos de la nota de entrega'} extra={editing ? <Text type="warning">Modo edición</Text> : null} variant="borderless">
            <NotaForm nota={formValue} onCancel={reset} onChange={handleChange} onSave={save} />
          </Card>
          <aside className="notas-preview-column">
            <div className="notas-preview-heading">
              <div>
                <Text strong>Vista previa</Text>
                <br />
                <Text type="secondary">Nota de entrega y verificación</Text>
              </div>
              <Space wrap>
                <Button icon={<FileWordOutlined />} disabled={!draft.clienteEntidad} onClick={() => word(draft)}>
                  Word
                </Button>
                <Button
                  type="primary"
                  icon={<FilePdfOutlined />}
                  loading={pdfLoading}
                  disabled={!draft.clienteEntidad}
                  onClick={() => handlePdfDownload(draft)}
                >
                  Descargar PDF
                </Button>
              </Space>
            </div>
            <div className="notas-preview-scroll">
              <NotaPreview nota={draft} />
            </div>
          </aside>
        </div>
      ) : (
        <Card title="Historial de notas" loading={loading} variant="borderless">
          <NotasHistory
            notas={notas}
            total={total}
            loading={loading}
            query={query}
            setQuery={setQuery}
            onCreateCertificado={createCertificado}
            onDelete={remove}
            onDuplicate={duplicate}
            onEdit={edit}
            onPdf={handlePdfDownload}
            onView={setViewing}
            onWord={word}
          />
        </Card>
      )}

      <Modal
        title="Vista previa de la nota"
        open={Boolean(viewing)}
        onCancel={() => setViewing(null)}
        width={1000}
        footer={
          viewing ? (
            <Space>
              <Button icon={<FileWordOutlined />} onClick={() => word(viewing)}>
                Descargar Word
              </Button>
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                loading={pdfLoading}
                onClick={() => handlePdfDownload(viewing)}
              >
                Descargar PDF
              </Button>
            </Space>
          ) : null
        }
      >
        {viewing && <div className="nota-modal-preview"><NotaPreview nota={viewing} /></div>}
      </Modal>
    </div>
  )
}
