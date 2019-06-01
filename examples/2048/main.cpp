#include "Engine.h"
#include <random>

std::random_device rd;
std::mt19937 rng(rd()); 

struct Game2048 : Screen
{
	std::shared_ptr<FilledRectangleComponent> background;
	std::shared_ptr<ComponentGrid> board;

	Game2048()
	: board(nullptr)
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		background = std::shared_ptr<FilledRectangleComponent>(
			new FilledRectangleComponent(entities,0xFFFFFFFF));

		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(4, 4),
				0.05,
				[this]()
				{
					auto container =  new RoundedRectangleComponent(
						entities,
						5.0f,
						0.0f,
						0x0,
						0x0000FFFF
					);
					return container;
				},
				[this]()
				{
					auto component = new RoundedRectangleComponent(
						entities,
						5.0f,
						0.0f,
						0x0f,
						0x226699FF
					);

					auto label = std::shared_ptr<struct Component>(
						new TextComponent(entities, "2", 0xFFFFFFFF, 18.0f));
					//label->setSizeMode(entities, Component::SizeMode_SizeToContents);
					label->setRelativePosition(entities, Vector2(0.5f, 0.3f));
					label->setAnchorPoint(entities, Vector2(0.5f, 0.5f));
					//label->setOffsetPosition(entities, Vector2(4.0f, -4.0f));
					label->setRelativeSize(entities, Vector2(0.7, 1.0));

					component->addChild(entities, label);
					return component;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					auto component = dynamic_cast<RoundedRectangleComponent*>(cell);
					
					char buff[16];
					sprintf(buff, "%u", state);
					auto label = std::dynamic_pointer_cast<TextComponent>(component->children[0]);
					label->setText(entities, buff);

				}
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		board->spawn(entities, 0, 3, 2);
		board->spawn(entities, 0, 1, 2);
		// board->spawn(entities, 1, 3, 0);
		// board->spawn(entities, 1, 1, 0);

		background->addChild(entities, board);
		rootComponent->addChild(entities, background);
	}

	bool fallLeft()
	{
		bool didMove = false;
		for (int32_t row = 0; row < board->maxGridSize.y; ++row)
		{
			int32_t firstEmpty = -1;
			std::shared_ptr<ComponentCell> lastFilled = nullptr;
			for (int32_t column = 0; column < board->maxGridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				if (cell)
				{
					if (lastFilled && lastFilled->state == cell->state)
					{
						board->remove(entities, cell);
						board->setState(lastFilled, lastFilled->state*2);
						didMove = true;
					}
					else if (firstEmpty > -1)
					{
						board->move(entities, row, column, row, firstEmpty);
						firstEmpty = firstEmpty + 1;
						lastFilled = cell;
						didMove = true;
					}
					else
					{
						lastFilled = cell;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = column;
				}
			}
		}
		return didMove;
	}

	bool fallUp()
	{
		bool didMove = false;
		for (int32_t column = 0; column < board->maxGridSize.x; ++column)
		{
			int32_t firstEmpty = -1;
			std::shared_ptr<ComponentCell> lastFilled = nullptr;
			for (int32_t row = 0; row < board->maxGridSize.y; ++row)
			{
				auto cell = board->grid[row][column];
				if (cell)
				{
					if (lastFilled && lastFilled->state == cell->state)
					{
						board->remove(entities, cell);
						board->setState(lastFilled, lastFilled->state*2);
						didMove = true;
					}
					else if (firstEmpty > -1)
					{
						board->move(entities, row, column, firstEmpty, column);
						firstEmpty = firstEmpty + 1;
						lastFilled = cell;
						didMove = true;
					}
					else
					{
						lastFilled = cell;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = row;
				}
			}
		}
		return didMove;
	}

	bool fallDown()
	{
		bool didMove = false;
		for (int32_t column = 0; column < board->maxGridSize.x; ++column)
		{
			int32_t firstEmpty = -1;
			std::shared_ptr<ComponentCell> lastFilled = nullptr;
			for (int32_t row = board->maxGridSize.y-1; row >= 0; --row)
			{
				auto cell = board->grid[row][column];
				if (cell)
				{
					if (lastFilled && lastFilled->state == cell->state)
					{
						board->remove(entities, cell);
						board->setState(lastFilled, lastFilled->state*2);
						didMove = true;
					}
					else if (firstEmpty > -1)
					{
						board->move(entities, row, column, firstEmpty, column);
						firstEmpty = firstEmpty - 1;
						lastFilled = cell;
						didMove = true;
					}
					else
					{
						lastFilled = cell;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = row;
				}
			}
		}
		return didMove;
	}

	bool fallRight()
	{
		bool didMove = false;
		for (int32_t row = 0; row < board->maxGridSize.y; ++row)
		{
			int32_t firstEmpty = -1;
			std::shared_ptr<ComponentCell> lastFilled = nullptr;
			for (int32_t column = board->maxGridSize.x-1; column >= 0 ; --column)
			{
				auto cell = board->grid[row][column];
				if (cell)
				{
					if (lastFilled && lastFilled->state == cell->state)
					{
						board->remove(entities, cell);
						board->setState(lastFilled, lastFilled->state*2);
						didMove = true;
					}
					else if (firstEmpty > -1)
					{
						board->move(entities, row, column, row, firstEmpty);
						firstEmpty = firstEmpty - 1;
						lastFilled = cell;
						didMove = true;
					}
					else
					{
						lastFilled = cell;
					}
				}
				else if (firstEmpty == -1)
				{
					firstEmpty = column;
				}
			}
		}
		return didMove;
	}

	void spawnRandom()
	{
		uint32_t totalEmpty = 0;
		for (int32_t row = 0; row < board->maxGridSize.y; ++row)
		{
			for (int32_t column = 0; column < board->maxGridSize.x; ++column)
			{
				auto cell = board->grid[row][column];
				totalEmpty += cell ? 0 : 1;
			}
		}
		if (totalEmpty == 0)
		{
			return;
		}

		std::uniform_int_distribution<uint32_t> columnDist(0, board->gridSize.x-1);
		std::uniform_int_distribution<uint32_t> rowDist(0, board->gridSize.y-1);
		uint32_t row = 0;
		uint32_t column = 0;
		do
		{
			row = rowDist(rng);
			column = columnDist(rng);
		}
		while (board->grid[row][column]);

		board->spawn(entities, row, column, 2);
	}

	void onKeyDown(SDL_Keycode key) override
	{
		printf("onKeyDown\n");
		switch (key)
		{
			case SDLK_LEFT:
			case SDLK_a:
			{
				if (fallLeft())
				{
					spawnRandom();
					board->relayout(entities);
				}
				break;
			}
			case SDLK_RIGHT:
			case SDLK_d:
			{
				if (fallRight())
				{
					spawnRandom();
					board->relayout(entities);
				}
				break;
			}
			case SDLK_UP:
			case SDLK_w:
			{
				if (fallUp())
				{
					spawnRandom();
					board->relayout(entities);
				}
				break;
			}
			case SDLK_DOWN:
			case SDLK_s:
			{
				if (fallDown())
				{
					spawnRandom();
					board->relayout(entities);
				}
				break;
			}
			default:
			{
				break;
			}
		}
	}
};

struct Mode1 : Screen
{
	Mode1()
	{
		entities.push_back(Entity::fillCircle(Vector2(50.0f, 50.0f), 30.0f, 0xAA88FFFF));
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	Game game;
	std::shared_ptr<Screen> game2048 = std::shared_ptr<Screen>(new Game2048());
	std::shared_ptr<Screen> mode1 = std::shared_ptr<Screen>(new Mode1());
	game.setScreen(game2048);

	int32_t mode = 0;
	loop = [&]
	{
		int32_t newMode = Engine_GetMode();
		if (newMode != mode)
		{
			printf("New mode: %d\n", newMode);
			mode = newMode;
			switch (mode)
			{
				case 0:
				{
					game.setScreen(game2048);
					break;
				}
				case 1:
				{
					game.setScreen(mode1);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}