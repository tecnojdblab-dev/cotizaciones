import { useCallback, useState } from 'react'
import { Alert, Button, Card, message, Modal, Segmented, Space, Spin, Typography } from 'antd'
import {
  DownloadOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  HistoryOutlined,
  PlusOutlined,
} from '@ant-design/icons'
import CartaForm from './components/CartaForm.jsx'
import CartaPreview from './components/CartaPreview.jsx'
import CartasHistory from './components/CartasHistory.jsx'
import { createEmptyCarta, duplicateCarta, normalizeCarta } from './domain/carta.js'
import { useCartas } from './hooks/useCartas.js'
import { downloadCartaPdf } from './utils/downloadCartaPdf.js'
import { downloadCartaWord } from './utils/downloadCartaWord.js'
import './cartas.css'

const { Title, Text } = Typography

export default function CartasPage() {
  const { cartas, total, loading, error, query, setQuery, saveCarta, deleteCarta } = useCartas()
  const [activeView, setActiveView] = useState('crear')
  const [editingCarta, setEditingCarta] = useState(null)
  const [formCarta, setFormCarta] = useState(createEmptyCarta)
  const [draft, setDraft] = useState(createEmptyCarta)
  const [viewingCarta, setViewingCarta] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [wordExporting, setWordExporting] = useState(false)

  const handleDraftChange = useCallback((values) => {
    setDraft(normalizeCarta(values))
  }, [])

  const handlePdfDownload = useCallback(async (carta) => {
    if (!carta) return
    setPdfLoading(true)
    const hideMessage = message.loading('Generando PDF...', 0)
    try {
      await downloadCartaPdf(carta)
      message.success('PDF descargado correctamente')
    } catch (exportError) {
      console.error('[Cartas] Error al exportar PDF:', exportError)
      message.error(exportError.message || 'No se pudo generar el PDF')
    } finally {
      hideMessage()
      setPdfLoading(false)
    }
  }, [])

  const resetEditor = useCallback(() => {
    const empty = createEmptyCarta()
    setEditingCarta(null)
    setFormCarta(empty)
    setDraft(empty)
  }, [])

  const handleSave = async (values) => {
    try {
      const saved = await saveCarta(values, editingCarta?.id)
      message.success(saved.estado === 'finalizada' ? 'Carta finalizada' : 'Borrador guardado')
      resetEditor()
      setActiveView('historial')
    } catch (saveError) {
      message.error(saveError.message || 'No se pudo guardar la carta')
    }
  }

  const handleEdit = (carta) => {
    setEditingCarta(carta)
    setFormCarta(carta)
    setDraft(carta)
    setActiveView('crear')
  }

  const handleDuplicate = (carta) => {
    const copy = duplicateCarta(carta)
    setEditingCarta(null)
    setFormCarta(copy)
    setDraft(copy)
    setActiveView('crear')
    message.info('Se creó una copia editable de la carta')
  }

  const handleDelete = async (id) => {
    try {
      await deleteCarta(id)
      if (editingCarta?.id === id) resetEditor()
      message.success('Carta eliminada')
    } catch (deleteError) {
      message.error(deleteError.message || 'No se pudo eliminar la carta')
    }
  }

  const handleWord = async (carta) => {
    setWordExporting(true)
    try {
      await downloadCartaWord(carta)
    } catch (exportError) {
      message.error(exportError.message || 'No se pudo generar el documento Word')
    } finally {
      setWordExporting(false)
    }
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    if (view === 'crear' && !editingCarta) resetEditor()
  }

  return (
    <div className="cartas-page">
      <header className="cartas-page__header">
        <div>
          <Title level={3}>Cartas</Title>
          <Text type="secondary">Inicio / Documentos / Cartas</Text>
        </div>
        <Segmented
          value={activeView}
          onChange={handleViewChange}
          options={[
            { value: 'crear', label: 'Crear carta', icon: <PlusOutlined /> },
            { value: 'historial', label: 'Historial', icon: <HistoryOutlined /> },
          ]}
        />
      </header>

      {error && (
        <Alert
          className="cartas-page__alert"
          type="error"
          showIcon
          message="No se pudieron sincronizar las cartas"
          description={error.message}
        />
      )}

      {activeView === 'crear' ? (
        <div className="cartas-create-grid">
          <Card
            className="cartas-form-card"
            title={editingCarta ? 'Editar carta' : 'Datos de la carta'}
            extra={editingCarta ? <Text type="warning">Modo edición</Text> : null}
            variant="borderless"
          >
            <CartaForm
              carta={formCarta}
              onCancel={resetEditor}
              onChange={handleDraftChange}
              onSave={handleSave}
            />
          </Card>

          <aside className="cartas-preview-column">
            <div className="cartas-preview-column__heading">
              <div>
                <Text strong>Vista previa</Text>
                <br />
                <Text type="secondary">La hoja se adapta al formato seleccionado.</Text>
              </div>
              <Space wrap>
                <Button
                  icon={<FileWordOutlined />}
                  disabled={!draft.destinatario}
                  loading={wordExporting}
                  onClick={() => handleWord(draft)}
                >
                  Word
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  type="primary"
                  loading={pdfLoading}
                  disabled={!draft.destinatario}
                  onClick={() => handlePdfDownload(draft)}
                >
                  PDF
                </Button>
              </Space>
            </div>
            <div className="cartas-preview-scroll">
              <CartaPreview carta={draft} />
            </div>
          </aside>
        </div>
      ) : (
        <Card className="cartas-history-card" title="Historial de cartas" variant="borderless">
          <Spin spinning={loading}>
            <CartasHistory
              cartas={cartas}
              total={total}
              loading={loading}
              query={query}
              setQuery={setQuery}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
              onEdit={handleEdit}
              onPdf={handlePdfDownload}
              onView={setViewingCarta}
              onWord={handleWord}
            />
          </Spin>
        </Card>
      )}

      <Modal
        className="carta-view-modal"
        title={viewingCarta?.numero || 'Vista previa de la carta'}
        open={Boolean(viewingCarta)}
        onCancel={() => setViewingCarta(null)}
        width={900}
        footer={
          viewingCarta ? [
            <Button
              key="word"
              icon={<FileWordOutlined />}
              loading={wordExporting}
              onClick={() => handleWord(viewingCarta)}
            >
              Word
            </Button>,
            <Button
              key="pdf"
              type="primary"
              icon={<DownloadOutlined />}
              loading={pdfLoading}
              onClick={() => handlePdfDownload(viewingCarta)}
            >
              PDF
            </Button>,
          ] : null
        }
      >
        {viewingCarta && (
          <div className="carta-view-modal__scroll">
            <CartaPreview carta={viewingCarta} />
          </div>
        )}
      </Modal>
    </div>
  )
}
