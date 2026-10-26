import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Typography,
  message,
} from 'antd'
import {
  CheckCircleOutlined,
  LockOutlined,
  LoginOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { loginWithBackend } from '../../auth/auth.js'
import './HomePage.css'

const { Title, Paragraph, Text } = Typography

export default function HomePage() {
  const [loginOpen, setLoginOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [retrySeconds, setRetrySeconds] = useState(0)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  useEffect(() => {
    if (retrySeconds <= 0) return undefined
    const timer = window.setTimeout(() => setRetrySeconds((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [retrySeconds])

  const handleLogin = async (values) => {
    setLoading(true)

    try {
      const user = await loginWithBackend(values.email, values.password)

      message.success(`Bienvenido, ${user.name}`)
      setLoginOpen(false)
      form.resetFields()
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err.status === 429 && err.retryAfter) {
        setRetrySeconds(err.retryAfter)
      }
      message.error(err.message || 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="home-page">
      <section className="home-shell">
        <Row align="middle" gutter={[32, 32]} className="home-grid">
          <Col xs={24} lg={13}>
            <Space direction="vertical" size={22} className="home-copy">
              <Text className="home-kicker">Plataforma comercial empresarial</Text>
              <Title level={1}>Sistema de Cotizaciones</Title>
              <Title level={2}>Gestión comercial para productos, clientes y proformas</Title>
              <Paragraph>
                Centraliza el catálogo, administra clientes y genera proformas con una
                experiencia ordenada para equipos administrativos y vendedores.
              </Paragraph>

              <Space size={12} wrap className="home-actions">
                <Button
                  type="primary"
                  size="large"
                  icon={<LoginOutlined />}
                  onClick={() => setLoginOpen(true)}
                >
                  Iniciar sesión
                </Button>
              </Space>
            </Space>
          </Col>

          <Col xs={24} lg={11}>
            <Card className="home-card" bordered={false}>
              <Space direction="vertical" size={18}>
                <div className="home-card-header">
                  <SafetyCertificateOutlined />
                  <div>
                    <Title level={3}>Acceso por roles</Title>
                    <Text>Control inicial para perfiles Administrador y Vendedor.</Text>
                  </div>
                </div>

                <div className="home-feature">
                  <CheckCircleOutlined />
                  <span>Administrador con acceso completo a módulos y configuración.</span>
                </div>
                <div className="home-feature">
                  <CheckCircleOutlined />
                  <span>Vendedor enfocado en clientes, productos y cotizaciones.</span>
                </div>
                <div className="home-feature">
                  <CheckCircleOutlined />
                  <span>Protección de rutas internas.</span>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>
      </section>

      <Modal
        title="Iniciar sesión"
        open={loginOpen}
        onCancel={() => setLoginOpen(false)}
        footer={null}
        centered
        destroyOnHidden
      >
        <Card className="login-card" bordered={false}>
          <Form form={form} layout="vertical" onFinish={handleLogin} requiredMark={false}>
            <Form.Item
              label="Correo"
              name="email"
              rules={[
                { required: true, message: 'Ingresa tu correo' },
                { type: 'email', message: 'Ingresa un correo válido' },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="correo@empresa.com" autoComplete="username" />
            </Form.Item>

            <Form.Item
              label="Contraseña"
              name="password"
              rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="Contraseña"
                autoComplete="current-password"
              />
            </Form.Item>

            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              disabled={retrySeconds > 0}
              icon={<LoginOutlined />}
            >
              {retrySeconds > 0
                ? `Intenta de nuevo en ${Math.floor(retrySeconds / 60)}:${String(retrySeconds % 60).padStart(2, '0')}`
                : 'Ingresar'}
            </Button>
          </Form>
        </Card>
      </Modal>
    </main>
  )
}
