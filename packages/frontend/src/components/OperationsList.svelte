<script lang="ts">
  import { onMount } from 'svelte';

  let operations: any[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/operations', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error('Falha ao carregar operações');
      }

      operations = await res.json();
    } catch (err) {
      error = (err as Error).message;
    } finally {
      loading = false;
    }
  });

  function getStatusBadge(status: string) {
    const badges: Record<string, { color: string; label: string }> = {
      pending: { color: '#ff9800', label: 'Pendente' },
      confirmed: { color: '#2196f3', label: 'Confirmada' },
      completed: { color: '#4caf50', label: 'Completa' },
      cancelled: { color: '#f44336', label: 'Cancelada' },
    };
    return badges[status] || { color: '#999', label: status };
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  }
</script>

<div class="operations-list">
  {#if loading}
    <div class="loading">Carregando operações...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else if operations.length === 0}
    <div class="empty">Nenhuma operação encontrada</div>
  {:else}
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Programa</th>
            <th>Quantidade</th>
            <th>Valor Total</th>
            <th>Comissão</th>
            <th>Status</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody>
          {#each operations as op (op.id)}
            <tr>
              <td>{op.program.toUpperCase()}</td>
              <td>{parseInt(op.amount).toLocaleString('pt-BR')} pts</td>
              <td>{formatCurrency(parseFloat(op.total_price) || 0)}</td>
              <td>{formatCurrency(parseFloat(op.commission_amount) || 0)}</td>
              <td>
                <span
                  class="badge"
                  style="background-color: {getStatusBadge(op.status).color}"
                >
                  {getStatusBadge(op.status).label}
                </span>
              </td>
              <td>{formatDate(op.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .operations-list {
    width: 100%;
  }

  .loading,
  .error,
  .empty {
    text-align: center;
    padding: 40px 20px;
    color: #666;
  }

  .error {
    background-color: #ffebee;
    color: #c62828;
    border-radius: 4px;
  }

  .table-wrapper {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: #f5f5f5;
  }

  th {
    padding: 15px;
    text-align: left;
    font-weight: 600;
    color: #333;
    border-bottom: 2px solid #e0e0e0;
  }

  td {
    padding: 15px;
    border-bottom: 1px solid #e0e0e0;
  }

  tr:hover {
    background-color: #fafafa;
  }

  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    color: white;
    font-size: 12px;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    table {
      font-size: 12px;
    }

    th,
    td {
      padding: 10px 5px;
    }
  }
</style>
