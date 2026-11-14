#!/bin/zsh
cd "/Users/mlacy/Documents/claude code/eo-frontier/the-fold"
node frontier/exp/depth.mjs --model qwen3:4b --depths 2,5,10,20,50 --seed 1 --out runs/results/depth.csv > frontier/runs/results-depth.out 2>&1
node frontier/exp/run.mjs scaling --model qwen3:4b --sizes 1e3,1e4,1e5,1e6 --n 24 --arms apparatus --label apparatus-v2 --out runs/results/scaling.csv > frontier/runs/results-scaling-v2.out 2>&1
node frontier/exp/run.mjs ablate --model qwen3:4b --size 1e5 --n 24 --out runs/results/ablations.csv > frontier/runs/results-ablate.out 2>&1
node frontier/exp/compound.mjs --model qwen3:4b --n 200 --size 1e5 --out runs/results/compound.csv > frontier/runs/results-compound.out 2>&1
echo CHAIN-DONE > frontier/runs/chain.done
