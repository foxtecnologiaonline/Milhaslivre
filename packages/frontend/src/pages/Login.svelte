<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authStore } from '../stores/auth';

  const dispatch = createEventDispatcher();

  let email = '';
  let password = '';
  let error = '';
  let isLoading = false;

  async function handleSubmit() {
    error = '';
    isLoading = true;

    try {
      await authStore.login(email, password);
      dispatch('success');
    } catch (err) {
      error = (err as Error).message || 'Falha ao fazer login';
    } finally {
      isLoading = false;
    }
  }

  function handleRegisterClick() {
    dispatch('navigate', 'register');
  }
</script>

<div class="login-container">
  <div class="login-box">
    <h1>Login</h1>
    <form on:submit|preventDefault={handleSubmit}>
      {#if error}
        <div class="error-message">{error}</div>
      {/if}

      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="seu@email.com"
          required
          disabled={isLoading}
        />
      </div>

      <div class="form-group">
        <label for="password">Senha</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Sua senha"
          required
          disabled={isLoading}
        />
      </div>

      <button type="submit" class="btn-submit" disabled={isLoading}>
        {isLoading ? 'Entrando...' : 'Entrar'}
      </button>
    </form>

    <p class="signup-link">
      Não tem conta? <button on:click={handleRegisterClick}>Criar uma</button>
    </p>
  </div>
</div>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 20px;
  }

  .login-box {
    background: white;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 400px;
  }

  .login-box h1 {
    text-align: center;
    margin-bottom: 30px;
    color: #1976d2;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
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

  .signup-link {
    text-align: center;
    margin-top: 20px;
    font-size: 14px;
    color: #666;
  }

  .signup-link button {
    background: none;
    color: #1976d2;
    padding: 0;
    font-weight: bold;
    text-decoration: underline;
  }
</style>
