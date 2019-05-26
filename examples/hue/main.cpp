#include "Engine.h"

struct GameHue : Screen
{
	std::shared_ptr<ComponentGrid> board;

	GameHue()
	{
		rootComponent = std::shared_ptr<struct Component>(new struct Component(entities));
		rootComponent->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		auto background = std::shared_ptr<RoundedRectangleComponent>(
			new RoundedRectangleComponent(
				entities,
				10.0f,
				0.0f,
				0x0f,
				0xFFFFFFFF
		));
		background->setSizeMode(entities, Component::SizeMode_FixedAspectRatio);
		background->aspectRatio = 1.0f;
		background->setRelativeSize(entities, Vector2(1.0f, 1.0f));
		background->setOffsetSize(entities, Vector2(-100.0f, -100.0f));
		background->setRelativePosition(entities, Vector2(0.5f, 0.5f));
		background->setAnchorPoint(entities, Vector2(0.5f, 0.5f));

		board = std::shared_ptr<ComponentGrid>(
			new ComponentGrid(
				entities,
				Vector2Int(7, 7),
				0.0,
				// [this]()
				// {
				// 	return new RoundedRectangleComponent(
				// 		entities,
				// 		5.0f,
				// 		0.0f,
				// 		0x0f,
				// 		0x0000FF00
				// 	);
				// },
				nullptr,
				[this]()
				{
					auto cell = new RectangleComponent(
						entities,
						0xFF00FFFF
					);
					return cell;
				},
				[this](struct Component* cell, uint32_t row, uint32_t column, uint32_t state)
				{
					auto rectangle = dynamic_cast<RectangleComponent*>(cell);
					//assert rectangle not null
					printf("jhelms set state for rectangle: %p\n", rectangle);
					rectangle->setFillColor(entities, state); 
				}
			)
		);
		board->setRelativeSize(entities, Vector2(1.0f, 1.0f));

		for (int32_t row = 0; row < board->matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < board->matrixSize.x; ++column)
			{
				uint32_t red = 0xFF;
				uint32_t green = (0xFF * row) / board->matrixSize.y;
				uint32_t blue = (0xFF * column) / board->matrixSize.x;
				uint32_t rgba = (red << 24) + (green << 16) + (blue << 8) + 0xFF; 
				auto cell = board->spawn(entities, row, column, rgba);
				cell->enableDragging(
					nullptr,
					[this, cell](){
						board->swapToTop(entities, cell);
					},
					[this, cell](){
						cell->convertOffsetToRelativePosition(entities);
						swapWithClosestCell(cell);
					}
				);
			}
		}
		//board->move(entities, 0, 0, 0, 3);

		background->addChild(entities, board);
		rootComponent->addChild(entities, background);
	}

	void swapWithClosestCell(std::shared_ptr<ComponentCell> cell)
	{
		uint32_t inRow = cell->row;
		uint32_t inColumn = cell->column;
		uint32_t closestRow = inRow;
		uint32_t closestColumn = inColumn;
		float minDistance = 1000000;
		std::shared_ptr<ComponentCell> best = nullptr;
		for (int32_t row = 0; row < board->matrixSize.y; ++row)
		{
			for (int32_t column = 0; column < board->matrixSize.x; ++column)
			{
				if (row == inRow && column == inColumn)
				{
					continue;
				}
				auto other = board->grid[row][column];
				float distance = Vector2::distance(cell->screenPosition, other->screenPosition);
				if (distance < minDistance)
				{
					printf("closest: %p %ux%u, %4.2f at %4.2f to %4.2f\n",
						other.get(), row, column, distance, cell->screenPosition.x, other->screenPosition.x);
					minDistance = distance;
					best = other;
					closestRow = row;
					closestColumn = column;
				}
			}
		}

		if (minDistance < cell->screenSize.x)
		{
			printf("jhelms %ux%u will swap with %ux%u, %4.2f\n", inRow, inColumn, closestRow, closestColumn, minDistance);
			printf("consistent? %ux%u - %ux%u\n", closestRow, closestColumn, best->row, best->column);
			board->moveSwap(entities, inRow, inColumn, closestRow, closestColumn);
			printf("position now: %4.2fx%4.2f\n", cell->screenPosition.x, cell->screenPosition.y);
		}
	}
};

std::function<void()> loop;
void main_loop() { loop(); }

int main()
{
	printf("start 1\n");
	Game game;
	std::shared_ptr<Screen> gameHue = std::shared_ptr<Screen>(new GameHue());
	game.setScreen(gameHue);

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
					game.setScreen(gameHue);
					break;
				}
			}
		}
		game.loop();
	};

	emscripten_set_main_loop(main_loop, 0, true);

	return 1;
}