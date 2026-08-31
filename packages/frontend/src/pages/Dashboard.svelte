<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '../stores/auth';
  import OperationsList from '../components/OperationsList.svelte';
  import CreateOperation from '../components/CreateOperation.svelte';

  let currentTab = 'operations';
  let user: any = null;
  let stats: any = null;

  onMount(async () => {
    authStore.subscribe((value) => {
      user = value?.user;
    });

    // Fetch stats
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/operations/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        stats = await res.json();
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  });
</script>

<div class="dashboard">
  <div class="container">
    <div class="header">
      <h1>Dashboard</h1>
      <p>Bem-vindo, {user?.name}</p>
    </div>

    {#if stats}
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Operações Totais</div>
          <div class="stat-value">{stats.total_operations || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Operações Confirmadas</div>
          <div class="stat-value">{stats.completed_operations || 0}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Volume Movimentado</div>
          <div class="stat-value">R$ {(stats.total_volume || 0).toFixed(2)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Comissão Total</div>
          <div class="stat-value accent">R$ {(stats.total_commission || 0).toFixed(2)}</div>
        </div>
      </div>
    {/if}

    <div class="tabs">
      <button
        class:active={currentTab === 'operations'}
        on:click={() => (currentTab = 'operations')}
      >
        Minhas Operações
      </button>
      <button
        class:active={currentTab === 'create'}
        on:click={() => (currentTab = 'create')}
      >
        Nova Operação
      </button>
    </div>

    <div class="tab-content">
      {#if currentTab === 'operations'}
        <OperationsList />
      {:else if currentTab === 'create'}
        <CreateOperation on:success={() => (currentTab = 'operations')} />
      {/if}
    </div>
  </div>
</div>

<style>
  .dashboard {
    padding: 40px 20px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .header {
    margin-bottom: 40px;
  }

  .header h1 {
    font-size: 32px;
    margin-bottom: 8px;
    color: #333;
  }

  .header p {
    color: #666;
    font-size: 16px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin-bottom: 40px;
  }

  .stat-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .stat-label {
    font-size: 14px;
    color: #666;
    margin-bottom: 10px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: bold;
    color: #1976d2;
  }

  .stat-value.accent {
    color: #4caf50;
  }

  .tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 30px;
    border-bottom: 2px solid #e0e0e0;
  }

  .tabs button {
    background: none;
    color: #666;
    padding: 12px 20px;
    font-size: 16px;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    transition: all 0.3s;
  }

  .tabs button.active {
    color: #1976d2;
    border-bottom-color: #1976d2;
  }

  .tabs button:hover {
    color: #1976d2;
  }

  .tab-content {
    background: white;
    border-radius: 8px;
    padding: 20px;
  }

  @media (max-width: 768px) {
    .stats-grid {
      grid-template-columns: 1fr 1fr;
    }

    .header h1 {
      font-size: 24px;
    }
  }
</style>
