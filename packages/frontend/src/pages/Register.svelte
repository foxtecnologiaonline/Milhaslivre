<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '../stores/auth';

  const dispatch = createEventDispatcher();

  let formData = {
    email: '',
    name: '',
    cpf: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'seller' as 'seller' | 'buyer',
  };

  let error = '';
  let isLoading = false;

  async function handleSubmit() {
    error = '';

    if (formData.password !== formData.confirmPassword) {
      error = 'As senhas não conferem';
      return;
    }

    isLoading = true;

    try {
      await authStore.register({
        email: formData.email,
        name: formData.name,
        cpf: formData.cpf,
        phone: formData.phone,
        password: formData.password,
        role: formData.role,
      });
      dispatch('success');
    } catch (err) {
      error = (err as Error).message || 'Falha ao criar conta';
    } finally {
      isLoading = false;
    }
  }

  function handleLoginClick() {
    dispatch('navigate', 'login');
  }
</script>

<div class="register-container">
  <div class="register-box">
    <h1>Criar Conta</h1>

    <div class="role-selector">
      <label>
        <input
          type="radio"
          name="role"
          value="seller"
          bind:group={formData.role}
          disabled={isLoading}
        />
        Vendedor (Vender pontos/milhas)
      </label>
      <label>
        <input
          type="radio"
          name="role"
          value="buyer"
          bind:group={formData.role}
          disabled={isLoading}
        />
        Comprador (Comprar pontos/milhas)
      </label>
    </div>

    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-group">
        <label for="name">Nome Completo</label>
        <input
          id="name"
          type="text"
          bind:value={formData.name}
          placeholder="João Silva"
          required
          disabled={isLoading}
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            type="email"
            bind:value={formData.email}
            placeholder="seu@email.com"
            required
            disabled={isLoading}
          />
        </div>
        <div class="form-group">
          <label for="cpf">CPF</label>
          <input
            id="cpf"
            type="text"
            bind:value={formData.cpf}
            on:input={(e) => {
              const cleaned = e.currentTarget.value.replace(/\D/g, '');
              formData.cpf = cleaned.slice(0, 11);
            }}
            placeholder="000.000.000-00"
            maxlength="14"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <div class="form-group">
        <label for="phone">Telefone</label>
        <input
          id="phone"
          type="tel"
          bind:value={formData.phone}
          placeholder="11999999999"
          required
          disabled={isLoading}
        />
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="password">Senha</label>
          <input
            id="password"
            type="password"
            bind:value={formData.password}
            placeholder="Mínimo 8 caracteres"
            minlength="8"
            required
            disabled={isLoading}
          />
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirmar Senha</label>
          <input
            id="confirmPassword"
            type="password"
            bind:value={formData.confirmPassword}
            placeholder="Confirme sua senha"
            minlength="8"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      <button type="submit" class="btn-submit" disabled={isLoading}>
        {isLoading ? 'Criando conta...' : 'Criar Conta'}
      </button>
    </form>

    <p class="login-link">
      Já tem conta? <button on:click={handleLoginClick}>Fazer login</button>
    </p>
  </div>
</div>

<style>
  .register-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 20px;
  }

  .register-box {
    background: white;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 500px;
  }

  .register-box h1 {
    text-align: center;
    margin-bottom: 30px;
    color: #1976d2;
  }

  .role-selector {
    margin-bottom: 30px;
    padding: 20px;
    background-color: #f5f5f5;
    border-radius: 4px;
  }

  .role-selector label {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    cursor: pointer;
  }

  .role-selector input {
    margin-right: 10px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
    font-size: 14px;
  }

  .form-group input {
    width: 100%;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    transition: border-color 0.3s;
  }

  .form-group input:focus {
    outline: none;
    border-color: #1976d2;
  }

  .form-group input:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .btn-submit {
    width: 100%;
    padding: 12px;
    background-color: #1976d2;
    color: white;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    transition: background-color 0.3s;
    margin-top: 10px;
  }

  .btn-submit:hover:not(:disabled) {
    background-color: #1565c0;
  }

  .btn-submit:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    background-color: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .login-link {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: #666;
  }

  .login-link button {
    background: none;
    color: #1976d2;
    padding: 0;
    font-weight: bold;
    text-decoration: underline;
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .register-box {
      padding: 20px;
    }
  }
</style>
