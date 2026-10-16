import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Card, message, Modal, Segmented, Space, Typography } from 'antd'
import { FilePdfOutlined, FileWordOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons'
import logoJdblab from '../../../images/logojdblab.jpeg.png'
import CertificadoForm from './components/CertificadoForm.jsx'
import CertificadoPreview from './components/CertificadoPreview.jsx'
import CertificadosHistory from './components/CertificadosHistory.jsx'
import { addWarrantyYears, createEmptyCertificado, duplicateCertificado, normalizeCertificado } from './domain/certificado.js'
import { useCertificados } from './hooks/useCertificados.js'
import { downloadCertificadoPdf } from './utils/downloadCertificadoPdf.js'
import { downloadCertificadoWord } from './utils/downloadCertificadoWord.js'
import { FIRMANTE_PRESETS } from '../../shared/utils/firmantePresets.js'
import './certificados.css'

const { Title, Text } = Typography

export default function CertificadosPage() {
  const { certificados, total, loading, error, query, setQuery, saveCertificado, deleteCertificado } = useCertificados()
  const location = useLocation()
  const navigate = useNavigate()
  const [view, setView] = useState('crear')
  const [editing, setEditing] = useState(null)
  const [formValue, setFormValue] = useState(createEmptyCertificado)
  const [draft, setDraft] = useState(createEmptyCertificado)
  const [viewing, setViewing] = useState(null)
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleChange = useCallback((values) => setDraft(normalizeCertificado(values)), [])

  useEffect(() => {
    const nota = location.state?.notaOrigen
    if (!nota) return
    const preset = FIRMANTE_PRESETS[nota.empresaEntregadoPor]
    const certificado = normalizeCertificado({
      ...createEmptyCertificado(),
      idNotaOrigen: nota.id,
      idCliente: nota.clienteId,
      clienteEntidad: nota.clienteEntidad,
      objetoContratacion: nota.objetoContratacion,
      empresaFirmante: nota.empresaEntregadoPor || undefined,
      firmanteNombre: preset?.firmanteNombre || '',
      firmanteCargo: preset?.firmanteCargo || '',
      firmanteDocumento: preset?.firmanteDocumento || '',
      firmanteTelefono: preset?.firmanteTelefono || '',
      firmaImagen: preset?.firmaImagen || '',
      selloImagen: preset?.selloImagen || '',
      fechaDesde: nota.fechaEntrega || createEmptyCertificado().fechaDesde,
      items: (nota.items || []).map((item) => ({
        catalogoTipo: item.catalogoTipo || 'producto',
        catalogoId: item.catalogoId,
        descripcion: item.nombre || '',
        marca: '',
        modelo: item.codigo || '',
        cantidad: item.cantidad || 1,
        aclaraciones: item.numeroSerie ? `N.º de serie: ${item.numeroSerie}` : 'NUEVO',
      })),
    })
    certificado.fechaHasta = addWarrantyYears(certificado.fechaDesde, certificado.garantiaAnos)
    setEditing(null)
    setFormValue(certificado)
    setDraft(certificado)
    setView('crear')
    navigate('/certificados', { replace: true, state: null })
  }, [location.state, navigate])

  const handlePdfDownload = useCallback(async (certificado) => {
    if (!certificado) return
    setPdfLoading(true)
    const hideMessage = message.loading('Generando PDF...', 0)
    try {
      await downloadCertificadoPdf(certificado)
      message.success('PDF descargado correctamente')
    } catch (error) {
      console.error('[Certificados] Error al exportar PDF:', error)
      message.error(error.message || 'No se pudo generar el PDF')
    } finally {
      hideMessage()
      setPdfLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    const empty = createEmptyCertificado()
    setEditing(null)
    setFormValue(empty)
    setDraft(empty)
  }, [])

  const save = async (values) => {
    try {
      await saveCertificado(values, editing?.id)
      message.success(values.estado === 'finalizado' ? 'Certificado finalizado' : 'Borrador guardado')
      reset()
      setView('historial')
    } catch (error) {
      message.error(error.message || 'No se pudo guardar')
    }
  }

  const edit = (item) => {
    setEditing(item)
    setFormValue(item)
    setDraft(item)
    setView('crear')
  }

  const duplicate = (item) => {
    const copy = duplicateCertificado(item)
    setEditing(null)
    setFormValue(copy)
    setDraft(copy)
    setView('crear')
  }

  const remove = async (id) => {
    try {
      await deleteCertificado(id)
      message.success('Certificado eliminado')
    } catch (requestError) {
      message.error(requestError.message || 'No se pudo eliminar')
    }
  }

  const word = async (item) => {
    try {
      await downloadCertificadoWord(item, logoJdblab)
    } catch (error) {
      message.error(error.message || 'No se pudo generar el Word')
    }
  }

  return (
    <div className="certificados-page">
      <header className="certificados-page__header">
        <div>
          <Title level={3}>Certificados</Title>
          <Text type="secondary">Inicio / Documentos / Certificados</Text>
        </div>
        <Segmented
          value={view}
          onChange={(value) => {
            setView(value)
            if (value === 'crear' && !editing) reset()
          }}
          options={[
            { value: 'crear', label: 'Crear certificado', icon: <PlusOutlined /> },
            { value: 'historial', label: 'Historial', icon: <HistoryOutlined /> },
          ]}
        />
      </header>

      {error && <Alert showIcon type="error" message="No se pudieron sincronizar los certificados" description={error.message} closable />}

      {view === 'crear' ? (
        <div className="certificados-create-grid">
          <Card title={editing ? 'Editar certificado' : 'Datos del certificado'} extra={editing ? <Text type="warning">Modo edición</Text> : null} variant="borderless">
            <CertificadoForm certificado={formValue} onCancel={reset} onChange={handleChange} onSave={save} />
          </Card>
          <aside className="certificados-preview-column">
            <div className="certificados-preview-heading">
              <div>
                <Text strong>Vista previa</Text>
                <br />
                <Text type="secondary">Certificado de garantía</Text>
              </div>
              <Space wrap>
                <Button icon={<FileWordOutlined />} disabled={!draft.clienteEntidad} onClick={() => word(draft)}>
                  Word
                </Button>
                <Button
                  icon={<FilePdfOutlined />}
                  type="primary"
                  loading={pdfLoading}
                  disabled={!draft.clienteEntidad}
                  onClick={() => handlePdfDownload(draft)}
                >
                  Descargar PDF
                </Button>
              </Space>
            </div>
            <div className="certificados-preview-scroll">
              <CertificadoPreview certificado={draft} />
            </div>
          </aside>
        </div>
      ) : (
        <Card title="Historial de certificados" loading={loading} variant="borderless">
          <CertificadosHistory
            certificados={certificados}
            total={total}
            loading={loading}
            query={query}
            setQuery={setQuery}
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
        title="Vista previa del certificado"
        open={Boolean(viewing)}
        onCancel={() => setViewing(null)}
        width={960}
        footer={
          viewing ? (
            <Button
              type="primary"
              icon={<FilePdfOutlined />}
              loading={pdfLoading}
              onClick={() => handlePdfDownload(viewing)}
            >
              Descargar PDF
            </Button>
          ) : null
        }
      >
        {viewing && <div className="certificado-modal-preview"><CertificadoPreview certificado={viewing} /></div>}
      </Modal>
    </div>
  )
}
