<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  let formData = {
    program: 'smiles',
    amount: '',
    pricePerThousand: '',
    commissionPercentage: '5',
  };

  let loading = false;
  let error = '';
  let success = false;

  async function handleSubmit() {
    error = '';
    success = false;
    loading = true;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          program: formData.program,
          amount: parseInt(formData.amount),
          pricePerThousand: parseFloat(formData.pricePerThousand),
          commissionPercentage: parseFloat(formData.commissionPercentage),
        }),
      });

      if (!res.ok) {
        throw new Error('Falha ao criar operação');
      }

      success = true;
      setTimeout(() => dispatch('success'), 1500);

      formData = {
        program: 'smiles',
        amount: '',
        pricePerThousand: '',
        commissionPercentage: '5',
      };
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  }

  $: totalValue = formData.amount && formData.pricePerThousand
    ? (parseInt(formData.amount) / 1000) * parseFloat(formData.pricePerThousand)
    : 0;

  $: commission = totalValue * (parseFloat(formData.commissionPercentage) / 100);
</script>

<div class="create-operation">
  <h2>Criar Nova Operação</h2>

  {#if success}
    <div class="success">✓ Operação criada com sucesso!</div>
  {/if}

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <form on:submit|preventDefault={handleSubmit}>
    <div class="form-group">
      <label for="program">Programa</label>
      <select id="program" bind:value={formData.program} disabled={loading}>
        <option value="smiles">Smiles (Gol)</option>
        <option value="latampass">Latam Pass</option>
        <option value="azulconnect">Azul Connect</option>
        <option value="viceversa">Vice Versa (Avianca)</option>
      </select>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="amount">Quantidade de Pontos</label>
        <input
          id="amount"
          type="number"
          bind:value={formData.amount}
          placeholder="100000"
          min="1000"
          disabled={loading}
          required
        />
      </div>

      <div class="form-group">
        <label for="price">Preço por Mil</label>
        <input
          id="price"
          type="number"
          bind:value={formData.pricePerThousand}
          placeholder="50.00"
          step="0.01"
          min="0.01"
          disabled={loading}
          required
        />
      </div>
    </div>

    <div class="form-group">
      <label for="commission">Sua Comissão (%)</label>
      <input
        id="commission"
        type="number"
        bind:value={formData.commissionPercentage}
        placeholder="5"
        step="0.1"
        min="0"
        max="100"
        disabled={loading}
        required
      />
    </div>

    <div class="summary">
      <h3>Resumo</h3>
      <div class="summary-row">
        <span>Valor Total:</span>
        <strong>R$ {totalValue.toFixed(2)}</strong>
      </div>
      <div class="summary-row highlight">
        <span>Sua Comissão:</span>
        <strong>R$ {commission.toFixed(2)}</strong>
      </div>
    </div>

    <button type="submit" disabled={loading}>
      {loading ? 'Criando...' : 'Criar Operação'}
    </button>
  </form>
</div>

<style>
  .create-operation {
    max-width: 600px;
    margin: 0 auto;
  }

  h2 {
    margin-bottom: 20px;
    color: #1976d2;
  }

  .success {
    background-color: #e8f5e9;
    color: #2e7d32;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
  }

  .error {
    background-color: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 4px;
    margin-bottom: 20px;
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
  }

  .form-group input,
  .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #1976d2;
  }

  .summary {
    background-color: #f5f5f5;
    padding: 15px;
    border-radius: 4px;
    margin: 20px 0;
  }

  .summary h3 {
    margin-bottom: 10px;
    font-size: 16px;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    color: #666;
  }

  .summary-row.highlight {
    background-color: #e3f2fd;
    padding: 10px;
    border-radius: 4px;
    color: #1976d2;
  }

  button {
    width: 100%;
    padding: 12px;
    background-color: #4caf50;
    color: white;
    border-radius: 4px;
    font-weight: bold;
    font-size: 16px;
  }

  button:hover:not(:disabled) {
    background-color: #45a049;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
